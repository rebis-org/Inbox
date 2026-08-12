import { option } from '@moeru/results';
import PostalMime from 'postal-mime';
import { Folders } from '../shared/folders';
import { storeParsedAttachments } from './attachments';
import { emailAddresses } from './config';
import { mailboxKey } from './registry';
import type { Env, NewEmail } from './types';

const MAX_EMAIL_SIZE = 25 * 1024 * 1024;

async function readRaw(stream: ReadableStream, streamSize: number): Promise<Uint8Array> {
  if (streamSize > MAX_EMAIL_SIZE) {
    throw new Error(`Email too large: ${streamSize} bytes exceeds ${MAX_EMAIL_SIZE} byte limit`);
  }
  if (streamSize <= 0) throw new Error(`Invalid stream size: ${streamSize}`);
  const result = new Uint8Array(streamSize);
  let bytesRead = 0;
  const reader = stream.getReader();
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const { done, value } = await reader.read();
    if (done) break;
    if (bytesRead + value.length > streamSize) {
      reader.cancel();
      throw new Error('Stream exceeds declared size');
    }
    result.set(value, bytesRead);
    bytesRead += value.length;
  }
  return result;
}

const MESSAGE_ID_ANGLE_REGEX = /<([^>]+)>/;
const MESSAGE_ID_WHITESPACE_REGEX = /\s+/;

function extractMessageId(value: string) {
  const match = MESSAGE_ID_ANGLE_REGEX.exec(value);
  return match ? match[1] : value.trim().split(MESSAGE_ID_WHITESPACE_REGEX, 1)[0];
}

interface IncomingEmailMessage {
  raw: ReadableStream,
  rawSize: number,
  to?: string
}

function normalizeAddress(address: string | null | undefined) {
  const normalized = address?.trim().toLowerCase();
  return normalized || undefined;
}

function parsedAddressList(addresses: Array<{ address?: string | null }> | undefined) {
  if (!addresses) return [];
  const result: string[] = [];
  for (let i = 0, len = addresses.length; i < len; i++) {
    const normalized = normalizeAddress(addresses[i].address);
    if (normalized) result.push(normalized);
  }
  return result;
}

export async function receiveEmail(event: IncomingEmailMessage, env: Env): Promise<void> {
  const raw = await readRaw(event.raw, event.rawSize);
  const parsed = await new PostalMime().parse(raw);
  const envelopeRecipient = normalizeAddress(event.to);
  const to = parsedAddressList(parsed.to);
  if (!envelopeRecipient && to.length === 0) {
    throw new Error('Received email with no To recipient');
  }
  const cc = parsedAddressList(parsed.cc);
  const bcc = parsedAddressList(parsed.bcc);
  const allowedAddresses = emailAddresses(env).map((a) => a.toLowerCase());

  let mailboxId: string | undefined;
  if (allowedAddresses.length > 0) {
    const routingRecipients = envelopeRecipient ? [envelopeRecipient] : to;
    mailboxId = routingRecipients.find((address) => allowedAddresses.includes(address));
    if (!mailboxId) {
      // eslint-disable-next-line no-console
      console.log('Ignoring email: no recipient matches EMAIL_ADDRESSES.');
      return;
    }
  } else {
    mailboxId = envelopeRecipient ?? to[0];
  }
  if (!mailboxId) {
    throw new Error('Received email with no valid recipient address');
  }
  if (!(await env.BUCKET.head(mailboxKey(mailboxId)))) {
    // eslint-disable-next-line no-console
    console.log(`Ignoring email for ${mailboxId}: mailbox does not exist`);
    return;
  }

  const mailbox = env.MAILBOX.get(env.MAILBOX.idFromName(mailboxId));
  const id = crypto.randomUUID();
  const attachments = await storeParsedAttachments(
    env.BUCKET,
    id,
    parsed.attachments.map((att) => ({
      filename: att.filename || 'untitled',
      mimeType: att.mimeType,
      content: att.content,
      contentId: att.contentId,
      disposition: att.disposition || undefined
    }))
  );

  const inReplyTo = parsed.inReplyTo ? extractMessageId(parsed.inReplyTo) : null;
  const references = parsed.references
    ? parsed.references.split(MESSAGE_ID_WHITESPACE_REGEX).reduce((ids: string[], ref) => {
      const id = extractMessageId(ref);
      if (id) ids.push(id);
      return ids;
    }, [])
    : [];
  let threadId = references[0] || inReplyTo || id;
  if (!inReplyTo && references.length === 0) {
    const matchedThreadId = await mailbox.findThreadBySubject(
      parsed.subject || '',
      parsed.from?.address || undefined
    );
    if (option.isSome(matchedThreadId)) threadId = matchedThreadId.value;
  }

  const record: NewEmail = {
    id,
    subject: parsed.subject || '',
    sender: (parsed.from?.address || '').toLowerCase(),
    recipient: to.length ? to.join(', ') : mailboxId,
    cc: cc.join(', ') || null,
    bcc: bcc.join(', ') || null,
    date: new Date().toISOString(),
    body: parsed.html || parsed.text || '',
    in_reply_to: inReplyTo,
    email_references: references.length ? JSON.stringify(references) : null,
    thread_id: threadId,
    message_id: parsed.messageId ? extractMessageId(parsed.messageId) : null,
    raw_headers: JSON.stringify(parsed.headers)
  };
  await mailbox.createEmail(Folders.INBOX, record, attachments);
}
