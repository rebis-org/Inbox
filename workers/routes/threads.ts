import { routing } from 'lemmih';
import type { App } from 'lemmih';
import { json } from '../http';
import type { RouteContext } from './context';

export function registerThreadRoutes(app: App, { withMailbox }: RouteContext) {
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
}
