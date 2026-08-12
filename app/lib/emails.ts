import { htmlToPlainText } from './html';
import { splitEmailList, toEmailListValue } from './utils';
import type { Mailbox } from '~/types';

export interface EmailPayload {
  to: string | string[] | undefined,
  cc: string | string[] | undefined,
  bcc: string | string[] | undefined,
  from: string | { email: string, name: string },
  subject: string,
  html: string,
  text: string
}

export function buildEmailPayload(
  mailbox: Mailbox,
  input: {
    to: string,
    cc?: string | null,
    bcc?: string | null,
    subject: string,
    body: string
  }
): EmailPayload {
  const fromName = mailbox.settings?.fromName || mailbox.name;
  return {
    to: toEmailListValue(splitEmailList(input.to)),
    cc: toEmailListValue(splitEmailList(input.cc)),
    bcc: toEmailListValue(splitEmailList(input.bcc)),
    from:
      fromName && fromName !== mailbox.email
        ? { email: mailbox.email, name: fromName }
        : mailbox.email,
    subject: input.subject,
    html: input.body,
    text: htmlToPlainText(input.body)
  };
}

export function listResponse<T>(data: { emails: T[], totalCount: number } | T[]): {
  emails: T[],
  totalCount: number
} {
  return Array.isArray(data)
    ? { emails: data, totalCount: data.length }
    : { emails: data.emails, totalCount: data.totalCount };
}
