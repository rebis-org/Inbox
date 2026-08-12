import { decodeBase64 } from '@moeru/std/base64';
import type { Attachment } from './types';

const UNSAFE_FILENAME = /[/\\:*?"<>|\p{Cc}]/gu;

export function sanitizeFilename(name: string) {
  return (name || 'untitled').replaceAll(UNSAFE_FILENAME, '_');
}

export function attachmentKey(emailId: string, attachmentId: string, filename: string) {
  return `attachments/${emailId}/${attachmentId}/${filename}`;
}

export async function deleteR2Keys(bucket: R2Bucket, keys: string[]): Promise<void> {
  const chunks: string[][] = [];
  for (let i = 0, len = keys.length; i < len; i += 1000) {
    chunks.push(keys.slice(i, i + 1000));
  }
  const deletes: Array<Promise<unknown>> = [];
  for (let i = 0, len = chunks.length; i < len; i++) {
    if (chunks[i].length > 0) deletes.push(bucket.delete(chunks[i]));
  }
  await Promise.all(deletes);
}

const DISPOSITION_UNSAFE = /[\p{Cc}"\\]/gu;

export function dispositionFilename(name: string) {
  return name.replaceAll(DISPOSITION_UNSAFE, '_');
}

async function putAttachments(
  bucket: R2Bucket,
  emailId: string,
  sources: Array<{
    filename: string,
    type: string,
    content: string | ArrayBuffer | Uint8Array,
    contentId?: string,
    disposition?: string
  }>,
  base64: boolean
): Promise<Attachment[]> {
  const puts = sources.map(async (source) => {
    const id = crypto.randomUUID();
    const filename = sanitizeFilename(source.filename);
    const content =
      base64 && typeof source.content === 'string' ? decodeBase64(source.content) : source.content;
    await bucket.put(attachmentKey(emailId, id, filename), content);
    return {
      id,
      email_id: emailId,
      filename,
      mimetype: source.type,
      size: typeof content === 'string' ? content.length : content.byteLength,
      content_id: source.contentId || null,
      disposition: source.disposition || 'attachment'
    } satisfies Attachment;
  });
  return Promise.all(puts);
}

export function storeAttachments(
  bucket: R2Bucket,
  emailId: string,
  attachments?: Array<{
    content: string,
    filename: string,
    type: string,
    disposition: string,
    contentId?: string
  }>
) {
  return attachments?.length
    ? putAttachments(bucket, emailId, attachments, true)
    : Promise.resolve([]);
}

export function storeParsedAttachments(
  bucket: R2Bucket,
  emailId: string,
  attachments: Array<{
    filename: string,
    mimeType: string,
    content: string | ArrayBuffer | Uint8Array,
    contentId?: string,
    disposition?: string
  }>
) {
  return putAttachments(
    bucket,
    emailId,
    attachments.map((att) => ({
      filename: att.filename,
      type: att.mimeType,
      content: att.content,
      contentId: att.contentId,
      disposition: att.disposition
    })),
    false
  );
}
