import { err, ok, option, result } from '@moeru/results';
import type { Result } from '@moeru/results';
import { withRetry } from '@moeru/std/with-retry';
import { Folders } from '../shared/folders';
import type { SendEmailRequest } from '../shared/schemas';
import { storeAttachments } from './attachments';
import { storeResendMapping } from './delivery';
import { apiError, json } from './http';
import type { MailboxDO } from './mailbox';
import { sendViaResend } from './resend';
import type { EmailFull, Env, NewEmail } from './types';
import { split1st } from 'foxts/split-nth';

export type MailboxStub = DurableObjectStub<MailboxDO>;

export interface ValidSender {
  to: string,
  from: string,
  domain: string
}

export function validateSender(
  to: string | string[],
  from: string | { email: string, name: string },
  mailboxId: string
): Result<ValidSender, string> {
  const toStr = (Array.isArray(to) ? to.join(', ') : to).toLowerCase();
  const fromEmail = (typeof from === 'string' ? from : from.email).toLowerCase();
  if (fromEmail !== mailboxId.toLowerCase()) {
    return err('From address must match the mailbox email address');
  }
  const domain = split1st(fromEmail, '@');
  if (!domain) return err('Invalid sender email address');
  return ok({ to: toStr, from: fromEmail, domain });
}

function generateMessageIds(domain: string) {
  const id = crypto.randomUUID();
  return { id, rfcId: `${id}@${domain}` };
}

export async function resolveOriginalEmail(
  mailbox: MailboxStub,
  email: EmailFull
): Promise<EmailFull> {
  if (email.folder_id === Folders.DRAFT && email.in_reply_to) {
    const original = await mailbox.getEmail(email.in_reply_to);
    if (option.isSome(original)) return original.value;
  }
  return email;
}

function buildThreadingChain(original: EmailFull) {
  const originalMsgId = original.message_id || original.id;
  let references: string[] = [];
  if (original.email_references) {
    try {
      references = JSON.parse(original.email_references);
    } catch {}
  }
  return {
    originalMsgId,
    references: [...references, originalMsgId].filter(Boolean),
    threadId: original.thread_id || original.id
  };
}

function normalizeAddresses(value: string | string[] | undefined): string | null {
  return value ? (Array.isArray(value) ? value.join(', ') : value).toLowerCase() : null;
}

function threadingHeaders(inReplyTo: string, references: string[]): Record<string, string> {
  return {
    'In-Reply-To': `<${inReplyTo}>`,
    ...(references.length && { References: references.map((r) => `<${r}>`).join(' ') })
  };
}

function rawHeaders(
  body: SendEmailRequest,
  rfcId: string,
  chain?: { originalMsgId: string, references: string[] }
) {
  return [
    {
      key: 'from',
      value: typeof body.from === 'string' ? body.from : `${body.from.name} <${body.from.email}>`
    },
    { key: 'to', value: Array.isArray(body.to) ? body.to.join(', ') : body.to },
    ...(body.cc
      ? [
        {
          key: 'cc',
          value: Array.isArray(body.cc) ? body.cc.join(', ') : body.cc
        }
      ]
      : []),
    ...(body.bcc
      ? [
        {
          key: 'bcc',
          value: Array.isArray(body.bcc) ? body.bcc.join(', ') : body.bcc
        }
      ]
      : []),
    { key: 'subject', value: body.subject },
    { key: 'date', value: new Date().toISOString() },
    { key: 'message-id', value: `<${rfcId}>` },
    ...(chain
      ? [
        { key: 'in-reply-to', value: `<${chain.originalMsgId}>` },
        ...(chain.references.length
          ? [
            {
              key: 'references',
              value: chain.references.map((r) => `<${r}>`).join(' ')
            }
          ]
          : [])
      ]
      : [])
  ] as Array<{ key: string, value: string }>;
}

export type SendThread = { mode: 'reply', original: EmailFull } | { mode: 'forward' };

function deferResend(
  env: Env,
  execution: ExecutionContext,
  mailbox: MailboxStub,
  mailboxId: string,
  emailId: string,
  body: SendEmailRequest,
  chain?: { originalMsgId: string, references: string[] }
) {
  execution.waitUntil(
    withRetry(
      async () => {
        const { messageId } = await sendViaResend(env.RESEND_API_KEY, {
          to: body.to,
          cc: body.cc,
          bcc: body.bcc,
          from: body.from,
          subject: body.subject,
          html: body.html,
          text: body.text,
          tags: [{ name: 'mailbox', value: mailboxId }],
          attachments: body.attachments?.map((att) => ({
            content: att.content,
            filename: att.filename,
            type: att.type,
            disposition: att.disposition,
            contentId: att.contentId
          })),
          ...(chain && {
            headers: threadingHeaders(chain.originalMsgId, chain.references)
          })
        });
        await mailbox.setResendInfo(emailId, messageId);
        await storeResendMapping(env.BUCKET, messageId, { mailboxId, emailId });
      },
      { retry: 2, retryDelay: 300 }
    )().catch(async (error) => {
      await mailbox.setDeliveryStatus(emailId, 'failed');
      // eslint-disable-next-line no-console
      console.error('Deferred email delivery failed:', (error as Error).message);
    })
  );
}

export async function sendMail(
  env: Env,
  execution: ExecutionContext,
  mailbox: MailboxStub,
  mailboxId: string,
  body: SendEmailRequest,
  thread?: SendThread
): Promise<Response> {
  const sender = validateSender(body.to, body.from, mailboxId);
  if (result.isErr(sender)) return apiError(400, sender.error);
  const validSender = sender.value;
  const rateLimit = await mailbox.checkSendRateLimit();
  if (rateLimit) {
    // eslint-disable-next-line no-console
    console.error('Send rate limit hit:', {
      mailbox: mailboxId,
      reason: rateLimit
    });
    return apiError(429, rateLimit);
  }

  const { id, rfcId } = generateMessageIds(validSender.domain);
  const attachments = await storeAttachments(env.BUCKET, id, body.attachments);
  const chain = thread?.mode === 'reply' ? buildThreadingChain(thread.original) : undefined;
  const record: NewEmail = {
    id,
    subject: body.subject,
    sender: validSender.from,
    recipient: validSender.to,
    cc: normalizeAddresses(body.cc),
    bcc: normalizeAddresses(body.bcc),
    date: new Date().toISOString(),
    body: body.html || body.text || '',
    in_reply_to: chain?.originalMsgId ?? body.in_reply_to ?? null,
    email_references: chain
      ? JSON.stringify(chain.references)
      : (body.references
        ? JSON.stringify(body.references)
        : null),
    thread_id:
      thread?.mode === 'forward'
        ? id
        : (chain?.threadId ?? body.thread_id ?? body.in_reply_to ?? id),
    message_id: rfcId,
    raw_headers: JSON.stringify(rawHeaders(body, rfcId, chain))
  };
  await mailbox.createEmail(Folders.SENT, record, attachments);
  if (chain) await mailbox.markThreadRead(chain.threadId);
  deferResend(env, execution, mailbox, mailboxId, id, body, chain);
  return json({ id, status: 'sent' }, 202);
}
