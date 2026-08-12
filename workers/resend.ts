import type { CreateEmailOptions } from 'resend';
import { Resend } from 'resend';
import { isObjectEmpty } from 'foxts/is-object-empty';

export interface SendParams {
  to: string | string[],
  from: string | { email: string, name: string },
  subject: string,
  html?: string,
  text?: string,
  cc?: string | string[],
  bcc?: string | string[],
  replyTo?: string | { email: string, name: string },
  attachments?: Array<{
    content: string,
    filename: string,
    type: string,
    disposition: 'attachment' | 'inline',
    contentId?: string
  }>,
  headers?: Record<string, string>,
  tags?: Array<{ name: string, value: string }>
}

export async function sendViaResend(
  apiKey: string,
  params: SendParams
): Promise<{ messageId: string }> {
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured');

  const resend = new Resend(apiKey);
  const from =
    typeof params.from === 'string' ? params.from : `${params.from.name} <${params.from.email}>`;
  let replyTo: string | undefined;
  if (typeof params.replyTo === 'string') {
    replyTo = params.replyTo;
  } else if (params.replyTo) {
    replyTo = `${params.replyTo.name} <${params.replyTo.email}>`;
  }

  const base = {
    to: params.to,
    from,
    subject: params.subject,
    tags: [{ name: 'app', value: 'inbox' }, ...(params.tags ?? [])],
    ...(params.cc && { cc: params.cc }),
    ...(params.bcc && { bcc: params.bcc }),
    ...(replyTo && { replyTo }),
    ...(params.headers && !isObjectEmpty(params.headers) && { headers: params.headers }),
    ...(params.attachments?.length && {
      attachments: params.attachments.map((att) => ({
        content: att.content,
        filename: att.filename,
        contentType: att.type,

        ...(att.disposition === 'inline' && att.contentId && { contentId: att.contentId })
      }))
    })
  };

  const options: CreateEmailOptions = params.html
    ? {
      ...base,
      html: params.html,
      ...(params.text && { text: params.text })
    }
    : { ...base, text: params.text ?? '' };

  const { data, error } = await resend.emails.send(options);
  if (error) {
    const err = new Error(error.message || 'Failed to send email via Resend') as Error & {
      code?: string | number
    };
    err.code = error.name;
    throw err;
  }
  return { messageId: data.id };
}

const STATUS_BY_EVENT: Partial<Record<string, string>> = {
  delivered: 'delivered',
  delivery_delayed: 'delayed',
  bounced: 'bounced',
  complained: 'complained',
  failed: 'failed',
  suppressed: 'suppressed',
  scheduled: 'scheduled',
  queued: 'queued'
};

export async function getDeliveryStatus(
  apiKey: string,
  resendId: string
): Promise<{ status: string, lastEventAt?: string } | null> {
  if (!apiKey || !resendId) return null;
  const { data } = await new Resend(apiKey).emails.get(resendId);
  if (!data) return null;
  return {
    status: STATUS_BY_EVENT[data.last_event] ?? 'sent',
    lastEventAt: (data as { last_event_at?: string }).last_event_at
  };
}

export function verifyWebhook(
  secret: string,
  payload: string,
  headers: { id: string, timestamp: string, signature: string }
) {
  return new Resend().webhooks.verify({ payload, webhookSecret: secret, headers });
}
