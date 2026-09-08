import { option } from '@moeru/results';
import { routing } from 'lemmih';
import type { App } from 'lemmih';
import { attachmentKey, dispositionFilename } from '../attachments';
import { apiError } from '../http';
import type { RouteContext } from './context';

export function registerAttachmentRoutes(app: App, { env, withMailbox }: RouteContext) {
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
