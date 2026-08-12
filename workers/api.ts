import { err, ok, option, result } from '@moeru/results';
import type { Result } from '@moeru/results';
import { merge } from '@moeru/std/merge';
import { App, routing } from 'lemmih';
import type { Handler } from 'lemmih';
import { cors } from 'lemmih/cors';
import { splitByCase } from 'scule';
import { Folders } from '../shared/folders';
import {
  CreateMailboxBodySchema,
  DraftBodySchema,
  FolderBodySchema,
  MoveEmailBodySchema,
  SendEmailRequestSchema,
  UpdateEmailBodySchema,
  UpdateMailboxBodySchema
} from '../shared/schemas';
import { attachmentKey, deleteR2Keys, dispositionFilename } from './attachments';
import { domains, emailAddresses } from './config';
import { getDeliveryStatus } from './resend';
import { apiError, json, noContent, parseJsonBody } from './http';
import { mailboxKey, listMailboxes } from './registry';
import type { SearchFilterOptions, SortColumn } from './mailbox';
import { resolveOriginalEmail, sendMail } from './send';
import type { MailboxStub } from './send';
import { handleResendWebhook } from './webhook';
import type { Env } from './types';

const ALLOWED_METHODS = ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'];

function allowOrigin(origin: string | null): string | undefined {
  if (!origin) return undefined;
  try {
    const url = new URL(origin);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return origin;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function intParam(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

function boolParam(value: string | null): boolean | undefined {
  if (value === null || value === '') return undefined;
  return value === 'true' || value === '1';
}

const NON_LETTER_OR_NUMBER = /[^\p{L}\p{N}]+/u;

function slugify(text: string) {
  return splitByCase(text)
    .flatMap((part) => part
      .trim()
      .toLowerCase()
      .split(NON_LETTER_OR_NUMBER)
      .filter(Boolean))
    .join('-');
}

function decodeParams<P extends Record<string, string>>(
  params: Record<string, string> | undefined
): P {
  return Object.entries(params ?? {}).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[key] = decodeURIComponent(value);
    return acc;
  }, {}) as P;
}

type MailboxHandler<P extends { mailboxId: string }> = (
  request: Request,
  params: P,
  mailbox: MailboxStub
) => Response | Promise<Response>;

async function resolveMailbox(env: Env, mailboxId: string): Promise<Result<MailboxStub, Response>> {
  if (!(await env.BUCKET.head(mailboxKey(mailboxId)))) {
    return err(apiError(404, 'Mailbox not found'));
  }
  return ok(env.MAILBOX.get(env.MAILBOX.idFromName(mailboxId)));
}

export function apiFetch(
  request: Request,
  env: Env,
  execution: ExecutionContext,
  ssr: (request: Request) => Response | Promise<Response>
): Promise<Response> {
  const app = new App((req) => Promise.resolve(ssr(req)));

  app.layer(
    cors({
      origin: (origin) => allowOrigin(origin) ?? null,
      allowMethods: ALLOWED_METHODS
    })
  );
  app.layer(async (req, next) => {
    try {
      return await next(req);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      return new Response('Internal Server Error', { status: 500 });
    }
  });
  registerRoutes(app, env, execution);
  return app.fetch(request);
}

function registerRoutes(app: App, env: Env, execution: ExecutionContext): void {
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

  app.route(
    '/api/v1/config',
    routing.get(() => json({ domains: domains(env), emailAddresses: emailAddresses(env) }))
  );

  app.route(
    '/api/v1/webhooks/resend',
    routing.post((request) => handleResendWebhook(env, request))
  );

  const mailboxes = routing.get(async () => {
    const ids = await listMailboxes(env.BUCKET);
    return json(ids.map((id) => ({ id, email: id, name: id })));
  });
  mailboxes.post([
    async (request) => {
      const parsed = await parseJsonBody(request, CreateMailboxBodySchema);
      if (result.isErr(parsed)) return parsed.error;
      const { name, settings, email: rawEmail } = parsed.value;
      const email = rawEmail.toLowerCase();
      const allowed = emailAddresses(env);
      if (allowed.length > 0 && !allowed.some((a) => a.toLowerCase() === email)) {
        return apiError(403, 'Mailbox creation is restricted to configured EMAIL_ADDRESSES');
      }
      const key = mailboxKey(email);
      if (await env.BUCKET.head(key)) {
        return apiError(409, 'Mailbox already exists');
      }
      const defaults = {
        fromName: name,
        forwarding: { enabled: false, email: '' },
        signature: { enabled: false, text: '', html: '' },
        autoReply: { enabled: false, subject: '', message: '' }
      };
      const finalSettings = merge(defaults, settings as Partial<typeof defaults>);
      await env.BUCKET.put(key, JSON.stringify(finalSettings));

      await env.MAILBOX.get(env.MAILBOX.idFromName(email)).listFolders();
      return json({ id: email, email, name, settings: finalSettings }, 201);
    }
  ]);
  app.route('/api/v1/mailboxes', mailboxes);

  const mailbox = routing.get(async (_request, params: { mailboxId: string }) => {
    const p = decodeParams(params);
    const obj = await env.BUCKET.get(mailboxKey(p.mailboxId));
    if (!obj) return apiError(404, 'Mailbox not found');
    return json({
      id: p.mailboxId,
      name: p.mailboxId,
      email: p.mailboxId,
      settings: await obj.json()
    });
  });
  mailbox.put([
    async (request, params) => {
      const p = decodeParams(params);
      const parsed = await parseJsonBody(request, UpdateMailboxBodySchema);
      if (result.isErr(parsed)) return parsed.error;
      const { settings } = parsed.value;
      const key = mailboxKey(p.mailboxId);
      if (!(await env.BUCKET.head(key))) {
        return apiError(404, 'Mailbox not found');
      }
      await env.BUCKET.put(key, JSON.stringify(settings));
      return json({
        id: p.mailboxId,
        name: p.mailboxId,
        email: p.mailboxId,
        settings
      });
    }
  ]);
  mailbox.delete([
    async (_request, params) => {
      const p = decodeParams(params);
      const key = mailboxKey(p.mailboxId);
      if (!(await env.BUCKET.head(key))) {
        return apiError(404, 'Mailbox not found');
      }

      const mailbox = env.MAILBOX.get(env.MAILBOX.idFromName(p.mailboxId));
      await mailbox.destroyMailbox();
      await env.BUCKET.delete(key);
      return noContent();
    }
  ]);
  app.route('/api/v1/mailboxes/:mailboxId', mailbox);

  const emails = routing.get(
    withMailbox(async (request, _params, mailbox) => {
      const searchParams = new URL(request.url).searchParams;
      const folder = searchParams.get('folder') ?? undefined;
      const threadId = searchParams.get('thread_id') ?? undefined;
      if (folder && boolParam(searchParams.get('threaded'))) {
        return json({
          emails: await mailbox.listThreads(
            folder,
            intParam(searchParams.get('page')),
            intParam(searchParams.get('limit'))
          ),
          totalCount: await mailbox.countThreads(folder)
        });
      }
      const emails = await mailbox.listEmails({
        folder,
        threadId,
        page: intParam(searchParams.get('page')),
        limit: intParam(searchParams.get('limit')),
        sortColumn: (searchParams.get('sortColumn') ?? undefined) as SortColumn | undefined,
        sortDirection: searchParams.get('sortDirection') as 'ASC' | 'DESC' | undefined
      });
      if (folder) {
        return json({
          emails,
          totalCount: await mailbox.countEmails({ folder, threadId })
        });
      }
      return json(emails);
    })
  );
  emails.post([
    withMailbox(async (request, params, mailbox) => {
      const parsed = await parseJsonBody(request, SendEmailRequestSchema);
      if (result.isErr(parsed)) return parsed.error;
      return sendMail(env, execution, mailbox, params.mailboxId, parsed.value);
    })
  ]);
  app.route('/api/v1/mailboxes/:mailboxId/emails', emails);

  app.route(
    '/api/v1/mailboxes/:mailboxId/drafts',
    routing.post(
      withMailbox(async (request, params, mailbox) => {
        const parsed = await parseJsonBody(request, DraftBodySchema);
        if (result.isErr(parsed)) return parsed.error;
        const {
          to,
          cc,
          bcc,
          subject,
          body,
          in_reply_to: inReplyTo,
          thread_id: threadId,
          draft_id: draftId
        } = parsed.value;
        if (draftId) await mailbox.deleteEmail(draftId);
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        await mailbox.createEmail(
          Folders.DRAFT,
          {
            id,
            subject: subject || '',
            sender: params.mailboxId.toLowerCase(),
            recipient: (to || '').toLowerCase(),
            cc: cc?.toLowerCase() || null,
            bcc: bcc?.toLowerCase() || null,
            date: now,
            body,
            in_reply_to: inReplyTo || null,
            email_references: null,
            thread_id: threadId || inReplyTo || id
          },
          []
        );
        return json(
          {
            id,
            status: 'draft',
            subject: subject || '',
            recipient: to || '',
            date: now
          },
          201
        );
      })
    )
  );

  const email = routing.get(
    withMailbox(async (_request, params: { mailboxId: string, id: string }, mailbox) => option.match(
      await mailbox.getEmail(params.id),
      (email) => json(email),
      () => apiError(404, 'Email not found')
    ))
  );
  email.put([
    withMailbox(async (request, params, mailbox) => {
      const parsed = await parseJsonBody(request, UpdateEmailBodySchema);
      if (result.isErr(parsed)) return parsed.error;
      const { read, starred } = parsed.value;
      return option.match(
        await mailbox.updateEmail(params.id, {
          read,
          starred
        }),
        (email) => json(email),
        () => apiError(404, 'Email not found')
      );
    })
  ]);
  email.delete([
    withMailbox(async (_request, params, mailbox) => {
      const attachments = await mailbox.deleteEmail(params.id);
      if (attachments === null) return apiError(404, 'Email not found');
      if (attachments.length) {
        await deleteR2Keys(
          env.BUCKET,
          attachments.map((att) => attachmentKey(params.id, att.id, att.filename))
        );
      }
      return noContent();
    })
  ]);
  app.route('/api/v1/mailboxes/:mailboxId/emails/:id', email);

  app.route(
    '/api/v1/mailboxes/:mailboxId/emails/:id/delivery-status',
    routing.get(
      withMailbox(async (_request, params, mailbox) => {
        const email = await mailbox.getEmail(params.id);
        if (option.isNone(email)) return apiError(404, 'Email not found');
        const emailValue = email.value;
        if (!emailValue.resend_id) return json({ status: null });
        const delivery = await getDeliveryStatus(env.RESEND_API_KEY, emailValue.resend_id);
        if (!delivery) {
          return json({
            status: emailValue.delivery_status,
            lastEventAt: null
          });
        }

        if (delivery.status !== emailValue.delivery_status) {
          await mailbox.setDeliveryStatus(params.id, delivery.status);
        }
        return json(delivery);
      })
    )
  );

  app.route(
    '/api/v1/mailboxes/:mailboxId/emails/:id/move',
    routing.post(
      withMailbox(async (request, params, mailbox) => {
        const parsed = await parseJsonBody(request, MoveEmailBodySchema);
        if (result.isErr(parsed)) return parsed.error;
        const { folderId } = parsed.value;
        const moved = await mailbox.moveEmail(params.id, folderId);
        return moved ? json({ status: 'moved' }) : apiError(400, 'Folder not found');
      })
    )
  );

  app.route(
    '/api/v1/mailboxes/:mailboxId/threads/:threadId',
    routing.get(
      withMailbox(async (_request, params, mailbox) => json(await mailbox.listThreadEmails(params.threadId)))
    )
  );

  app.route(
    '/api/v1/mailboxes/:mailboxId/threads/:threadId/read',
    routing.post(
      withMailbox(async (_request, params, mailbox) => {
        await mailbox.markThreadRead(params.threadId);
        return json({ status: 'marked_read' });
      })
    )
  );

  app.route(
    '/api/v1/mailboxes/:mailboxId/emails/:id/reply',
    routing.post(
      withMailbox(async (request, params, mailbox) => {
        const parsed = await parseJsonBody(request, SendEmailRequestSchema);
        if (result.isErr(parsed)) return parsed.error;
        const original = await mailbox.getEmail(params.id);
        if (option.isNone(original)) {
          return apiError(404, 'Original email not found');
        }
        return sendMail(env, execution, mailbox, params.mailboxId, parsed.value, {
          mode: 'reply',
          original: await resolveOriginalEmail(mailbox, original.value)
        });
      })
    )
  );

  app.route(
    '/api/v1/mailboxes/:mailboxId/emails/:id/forward',
    routing.post(
      withMailbox(async (request, params, mailbox) => {
        const parsed = await parseJsonBody(request, SendEmailRequestSchema);
        if (result.isErr(parsed)) return parsed.error;
        if (option.isNone(await mailbox.getEmail(params.id))) {
          return apiError(404, 'Original email not found');
        }
        return sendMail(env, execution, mailbox, params.mailboxId, parsed.value, {
          mode: 'forward'
        });
      })
    )
  );

  const folders = routing.get(
    withMailbox(async (_request, _params, mailbox) => json(await mailbox.listFolders()))
  );
  folders.post([
    withMailbox(async (request, _params, mailbox) => {
      const parsed = await parseJsonBody(request, FolderBodySchema);
      if (result.isErr(parsed)) return parsed.error;
      const { name } = parsed.value;
      const id = slugify(name);
      if (!id) {
        return apiError(400, 'Folder name must contain alphanumeric characters');
      }
      return option.match(
        await mailbox.createFolder(id, name),
        (folder) => json(folder, 201),
        () => apiError(409, 'Folder with this name already exists')
      );
    })
  ]);
  app.route('/api/v1/mailboxes/:mailboxId/folders', folders);

  const folder = routing.put(
    withMailbox(async (request, params: { mailboxId: string, id: string }, mailbox) => {
      const parsed = await parseJsonBody(request, FolderBodySchema);
      if (result.isErr(parsed)) return parsed.error;
      const { name } = parsed.value;
      return option.match(
        await mailbox.renameFolder(params.id, name),
        (folder) => json(folder),
        () => apiError(404, 'Folder not found')
      );
    })
  );
  folder.delete([
    withMailbox(async (_request, params, mailbox) => {
      const attachments = await mailbox.deleteFolder(params.id);
      if (attachments === false) {
        return apiError(400, 'Folder not found or cannot be deleted');
      }
      if (attachments.length) {
        await deleteR2Keys(
          env.BUCKET,
          attachments.map((att) => attachmentKey(att.email_id, att.id, att.filename))
        );
      }
      return noContent();
    })
  ]);
  app.route('/api/v1/mailboxes/:mailboxId/folders/:id', folder);

  app.route(
    '/api/v1/mailboxes/:mailboxId/search',
    routing.get(
      withMailbox(async (request, _params, mailbox) => {
        const searchParams = new URL(request.url).searchParams;
        const filters: SearchFilterOptions = {
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
        return json({
          emails: await mailbox.searchEmails({
            ...filters,
            page: intParam(searchParams.get('page')),
            limit: intParam(searchParams.get('limit'))
          }),
          totalCount: await mailbox.countSearchResults(filters)
        });
      })
    )
  );

  app.route(
    '/api/v1/mailboxes/:mailboxId/emails/:emailId/attachments/:attachmentId',
    routing.get(
      withMailbox(async (_request, params, mailbox) => {
        const attachment = await mailbox.getAttachment(params.attachmentId);
        if (option.isNone(attachment)) {
          return apiError(404, 'Attachment not found');
        }
        const attachmentValue = attachment.value;
        const obj = await env.BUCKET.get(
          attachmentKey(params.emailId, params.attachmentId, attachmentValue.filename)
        );
        if (!obj) return apiError(404, 'Attachment file not found');
        const headers = new Headers();
        headers.set('Content-Type', attachmentValue.mimetype);
        headers.set(
          'Content-Disposition',
          `attachment; filename="${dispositionFilename(attachmentValue.filename)}"; filename*=UTF-8''${encodeURIComponent(attachmentValue.filename)}`
        );
        return new Response(obj.body, { headers });
      })
    )
  );
}
