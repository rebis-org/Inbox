import type { Attachment } from '~/types';

const REGEX_ESCAPE_REGEX = /[.*+?^${}()|[\]\\]/g;

export function getAttachmentUrl(mailboxId: string, emailId: string, attachmentId: string): string {
  return `/api/v1/mailboxes/${mailboxId}/emails/${emailId}/attachments/${attachmentId}`;
}

export function getNonInlineAttachments(attachments?: Attachment[]): Attachment[] {
  return attachments?.filter((attachment) => attachment.disposition !== 'inline') ?? [];
}

export function rewriteInlineImages(
  body: string,
  mailboxId: string,
  emailId: string,
  attachments?: Array<{
    id: string,
    content_id?: string | null,
    disposition?: string | null
  }>
): string {
  if (!body || !attachments?.length) return body;
  let result = body;
  for (let i = 0, len = attachments.length; i < len; i++) {
    const att = attachments[i];
    if (att.disposition !== 'inline' || !att.content_id) continue;
    const url = getAttachmentUrl(mailboxId, emailId, att.id);
    const cid = att.content_id[0] === '<' ? att.content_id.slice(1, -1) : att.content_id;
    result = result.replaceAll(
      new RegExp(`cid:${cid.replaceAll(REGEX_ESCAPE_REGEX, String.raw`\$&`)}`, 'gi'),
      url
    );
  }
  return result;
}

export function downloadFile(url: string, filename: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
