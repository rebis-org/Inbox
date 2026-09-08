import { err, ok, result } from '@moeru/results';
import type { Result } from '@moeru/results';
import type { Handler } from 'lemmih';
import { attachmentKey, deleteR2Keys } from '../attachments';
import { apiError, boolParam, decodeParams, intParam } from '../http';
import type { SearchFilterOptions } from '../sql';
import { mailboxKey } from '../registry';
import type { MailboxStub } from '../send';
import type { Env } from '../types';

export type MailboxHandler<P extends { mailboxId: string }> = (
  request: Request,
  params: P,
  mailbox: MailboxStub
) => Response | Promise<Response>;

export async function resolveMailbox(env: Env, mailboxId: string): Promise<Result<MailboxStub, Response>> {
  if (!(await env.BUCKET.head(mailboxKey(mailboxId)))) {
    return err(apiError(404, 'Mailbox not found'));
  }
  return ok(env.MAILBOX.get(env.MAILBOX.idFromName(mailboxId)));
}

export interface RouteContext {
  env: Env,
  execution: ExecutionContext,
  withMailbox: <P extends { mailboxId: string }>(fn: MailboxHandler<P>) => Handler<P>
}

export function createRouteContext(env: Env, execution: ExecutionContext): RouteContext {
  const withMailbox =
    <P extends { mailboxId: string }>(fn: MailboxHandler<P>): Handler<P> => async (request, params) => {
      const p = decodeParams<P>(params);
      const scope = await resolveMailbox(env, p.mailboxId);
      return result.match(
        scope,
        (mailbox) => fn(request, p, mailbox),
        (response) => response
      );
    };
  return { env, execution, withMailbox };
}

export const mailboxPayload = (id: string, settings: unknown) => ({ id, name: id, email: id, settings });

export async function deleteEmailFiles(
  bucket: R2Bucket,
  files: Array<{ id: string, email_id?: string, filename: string }>,
  emailId: string
) {
  if (files.length) {
    await deleteR2Keys(
      bucket,
      files.map((att) => attachmentKey(att.email_id ?? emailId, att.id, att.filename))
    );
  }
}

export function searchFilters(searchParams: URLSearchParams): SearchFilterOptions {
  return {
    query: searchParams.get('query') || '',
    folder: searchParams.get('folder') ?? undefined,
    from: searchParams.get('from') ?? undefined,
    to: searchParams.get('to') ?? undefined,
    subject: searchParams.get('subject') ?? undefined,
    dateStart: searchParams.get('date_start') ?? undefined,
    dateEnd: searchParams.get('date_end') ?? undefined,
    isRead: boolParam(searchParams.get('is_read')),
    isStarred: boolParam(searchParams.get('is_starred')),
    hasAttachment: boolParam(searchParams.get('has_attachment'))
  };
}

export function pageOf(searchParams: URLSearchParams) {
  return {
    page: intParam(searchParams.get('page')),
    limit: intParam(searchParams.get('limit'))
  };
}
