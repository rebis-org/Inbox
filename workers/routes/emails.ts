import { option } from '@moeru/results';
import { routing } from 'lemmih';
import type { App } from 'lemmih';
import { Folders } from '../../shared/folders';
import {
  DraftBodySchema,
  MoveEmailBodySchema,
  SendEmailRequestSchema,
  UpdateEmailBodySchema
} from '../../shared/schemas';
import { apiError, boolParam, json, noContent, withBody } from '../http';
import type { SortColumn } from '../sql';
import { getDeliveryStatus } from '../resend';
import { resolveOriginalEmail, sendMail } from '../send';
import { deleteEmailFiles, pageOf } from './context';
import type { RouteContext } from './context';

export function registerEmailRoutes(app: App, { env, execution, withMailbox }: RouteContext) {
  const emails = routing.get(
    withMailbox(async (request, _params, mailbox) => {
      const searchParams = new URL(request.url).searchParams;
      const folder = searchParams.get('folder') ?? undefined;
      const threadId = searchParams.get('thread_id') ?? undefined;
      const { page, limit } = pageOf(searchParams);
      if (folder && boolParam(searchParams.get('threaded'))) {
        return json({
          emails: await mailbox.listThreads(folder, page, limit),
          totalCount: await mailbox.countThreads(folder)
        });
      }
      const list = await mailbox.listEmails({
        folder,
        threadId,
        page,
        limit,
        sortColumn: (searchParams.get('sortColumn') ?? undefined) as SortColumn | undefined,
        sortDirection: searchParams.get('sortDirection') as 'ASC' | 'DESC' | undefined
      });
      if (folder) {
        return json({
          emails: list,
          totalCount: await mailbox.countEmails({ folder, threadId })
        });
      }
      return json(list);
    })
  );
  emails.post([
    withMailbox(async (request, params, mailbox) => withBody(request, SendEmailRequestSchema, (body) => sendMail(env, execution, mailbox, params.mailboxId, body)))
  ]);
  app.route('/api/v1/mailboxes/:mailboxId/emails', emails);

  app.route(
    '/api/v1/mailboxes/:mailboxId/drafts',
    routing.post(
      withMailbox(async (request, params, mailbox) => withBody(request, DraftBodySchema, async ({
        to,
        cc,
        bcc,
        subject,
        body,
        in_reply_to: inReplyTo,
        thread_id: threadId,
        draft_id: draftId
      }) => {
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
      }))
    )
  );

  const email = routing.get(
    withMailbox(async (_request, params: { mailboxId: string, id: string }, mailbox) => option.match(
      await mailbox.getEmail(params.id),
      (value) => json(value),
      () => apiError(404, 'Email not found')
    ))
  );
  email.put([
    withMailbox(async (request, params, mailbox) => withBody(request, UpdateEmailBodySchema, async ({ read, starred }) => option.match(
      await mailbox.updateEmail(params.id, { read, starred }),
      (value) => json(value),
      () => apiError(404, 'Email not found')
    )))
  ]);
  email.delete([
    withMailbox(async (_request, params, mailbox) => {
      const attachments = await mailbox.deleteEmail(params.id);
      if (attachments === null) return apiError(404, 'Email not found');
      await deleteEmailFiles(env.BUCKET, attachments, params.id);
      return noContent();
    })
  ]);
  app.route('/api/v1/mailboxes/:mailboxId/emails/:id', email);

  app.route(
    '/api/v1/mailboxes/:mailboxId/emails/:id/delivery-status',
    routing.get(
      withMailbox(async (_request, params, mailbox) => {
        const found = await mailbox.getEmail(params.id);
        if (option.isNone(found)) return apiError(404, 'Email not found');
        const emailValue = found.value;
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
      withMailbox(async (request, params, mailbox) => withBody(request, MoveEmailBodySchema, async ({ folderId }) => {
        const moved = await mailbox.moveEmail(params.id, folderId);
        return moved ? json({ status: 'moved' }) : apiError(400, 'Folder not found');
      }))
    )
  );

  app.route(
    '/api/v1/mailboxes/:mailboxId/emails/:id/reply',
    routing.post(
      withMailbox(async (request, params, mailbox) => withBody(request, SendEmailRequestSchema, async (body) => {
        const original = await mailbox.getEmail(params.id);
        if (option.isNone(original)) {
          return apiError(404, 'Original email not found');
        }
        return sendMail(env, execution, mailbox, params.mailboxId, body, {
          mode: 'reply',
          original: await resolveOriginalEmail(mailbox, original.value)
        });
      }))
    )
  );

  app.route(
    '/api/v1/mailboxes/:mailboxId/emails/:id/forward',
    routing.post(
      withMailbox(async (request, params, mailbox) => withBody(request, SendEmailRequestSchema, async (body) => {
        if (option.isNone(await mailbox.getEmail(params.id))) {
          return apiError(404, 'Original email not found');
        }
        return sendMail(env, execution, mailbox, params.mailboxId, body, {
          mode: 'forward'
        });
      }))
    )
  );
}
