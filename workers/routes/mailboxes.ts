import { merge } from '@moeru/std/merge';
import { routing } from 'lemmih';
import type { App } from 'lemmih';
import { CreateMailboxBodySchema, UpdateMailboxBodySchema } from '../../shared/schemas';
import { emailAddresses } from '../config';
import { apiError, decodeParams, json, noContent, withBody } from '../http';
import { listMailboxes, mailboxKey } from '../registry';
import { mailboxPayload } from './context';
import type { RouteContext } from './context';

export function registerMailboxRoutes(app: App, { env }: RouteContext) {
  const mailboxes = routing.get(async () => {
    const ids = await listMailboxes(env.BUCKET);
    return json(ids.map((id) => ({ id, email: id, name: id })));
  });
  mailboxes.post([
    async (request) => withBody(request, CreateMailboxBodySchema, async ({ name, settings, email: rawEmail }) => {
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
    })
  ]);
  app.route('/api/v1/mailboxes', mailboxes);

  const mailbox = routing.get(async (_request, params: { mailboxId: string }) => {
    const p = decodeParams(params);
    const obj = await env.BUCKET.get(mailboxKey(p.mailboxId));
    if (!obj) return apiError(404, 'Mailbox not found');
    return json(mailboxPayload(p.mailboxId, await obj.json()));
  });
  mailbox.put([
    async (request, params) => withBody(request, UpdateMailboxBodySchema, async ({ settings }) => {
      const p = decodeParams(params);
      const key = mailboxKey(p.mailboxId);
      if (!(await env.BUCKET.head(key))) {
        return apiError(404, 'Mailbox not found');
      }
      await env.BUCKET.put(key, JSON.stringify(settings));
      return json(mailboxPayload(p.mailboxId, settings));
    })
  ]);
  mailbox.delete([
    async (_request, params) => {
      const p = decodeParams(params);
      const key = mailboxKey(p.mailboxId);
      if (!(await env.BUCKET.head(key))) {
        return apiError(404, 'Mailbox not found');
      }

      const stub = env.MAILBOX.get(env.MAILBOX.idFromName(p.mailboxId));
      await stub.destroyMailbox();
      await env.BUCKET.delete(key);
      return noContent();
    }
  ]);
  app.route('/api/v1/mailboxes/:mailboxId', mailbox);
}
