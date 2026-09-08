import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server';
import { apiFetch } from '../workers/api';
import { receiveEmail } from '../workers/inbound';
import { accessMiddleware } from '../workers/middleware';
import { listMailboxes } from '../workers/registry';

import type { Env } from '../workers/types';

const startFetch = createStartHandler(defaultStreamHandler);

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'same-origin');
  headers.set('X-Frame-Options', 'DENY');
  if (import.meta.env.DEV) {
    headers.set('Content-Security-Policy', 'frame-ancestors \'none\'');
  } else {
    headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    headers.set(
      'Content-Security-Policy',
      [
        'default-src \'self\'',
        'script-src \'self\' \'unsafe-inline\'',
        'style-src \'self\' \'unsafe-inline\'',
        'img-src \'self\' data: blob: https:',
        'font-src \'self\' data:',
        'connect-src \'self\'',
        'object-src \'none\'',
        'base-uri \'self\'',
        'form-action \'self\'',
        'frame-ancestors \'none\''
      ].join('; ')
    );
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const blocked = await accessMiddleware(request, env);
    if (blocked) return withSecurityHeaders(blocked);
    if (new URL(request.url).pathname.startsWith('/api/')) {
      return withSecurityHeaders(await apiFetch(request, env, ctx, startFetch));
    }
    return withSecurityHeaders(await startFetch(request));
  },
  async email(
    event: { raw: ReadableStream, rawSize: number, to?: string },
    env: Env,
    _ctx: ExecutionContext
  ) {
    try {
      await receiveEmail(event, env);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to process incoming email:', (e as Error).message, (e as Error).stack);

      throw e;
    }
  },
  scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil((async () => {
      const ids = await listMailboxes(env.BUCKET);
      await Promise.all(ids.map((id) => env.MAILBOX.get(env.MAILBOX.idFromName(id)).purgeTrash().catch((e: unknown) => {
        // eslint-disable-next-line no-console
        console.error('Trash purge failed:', (e as Error).message);
      })));
    })());
  }
};

export { MailboxDO } from '../workers/mailbox';
