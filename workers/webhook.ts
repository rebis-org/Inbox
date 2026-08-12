import { getResendMapping } from './delivery';
import { json, text } from './http';
import { verifyWebhook } from './resend';
import type { Env } from './types';

const STATUS_BY_EVENT: Record<string, string> = {
  'email.delivered': 'delivered',
  'email.delivery_delayed': 'delayed',
  'email.complained': 'complained',
  'email.bounced': 'bounced',
  'email.failed': 'failed',
  'email.suppressed': 'suppressed'
};

export async function handleResendWebhook(env: Env, request: Request): Promise<Response> {
  const secret = env.RESEND_WEBHOOK_SECRET;
  if (!secret) return text('RESEND_WEBHOOK_SECRET is not configured', 500);

  const payload = await request.text();
  let event: { type: string, data?: { email_id?: string } };
  try {
    event = verifyWebhook(secret, payload, {
      id: request.headers.get('webhook-id') ?? '',
      timestamp: request.headers.get('webhook-timestamp') ?? '',
      signature: request.headers.get('webhook-signature') ?? ''
    }) as { type: string, data?: { email_id?: string } };
  } catch {
    return text('Invalid webhook signature', 401);
  }

  const status = STATUS_BY_EVENT[event.type];
  const resendId = event.data?.email_id;
  if (!status || !resendId) return json({ ok: true });

  const mapping = await getResendMapping(env.BUCKET, resendId);
  if (mapping) {
    const mailbox = env.MAILBOX.get(env.MAILBOX.idFromName(mapping.mailboxId));
    await mailbox.setDeliveryStatus(mapping.emailId, status);
  }
  return json({ ok: true });
}
