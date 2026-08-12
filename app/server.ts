import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server';
import { apiFetch } from '../workers/api';
import { receiveEmail } from '../workers/inbound';
import { accessMiddleware } from '../workers/middleware';

import type { Env } from '../workers/types';

const startFetch = createStartHandler(defaultStreamHandler);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const blocked = await accessMiddleware(request, env);
    if (blocked) return blocked;
    if (new URL(request.url).pathname.startsWith('/api/')) {
      return apiFetch(request, env, ctx, startFetch);
    }
    return startFetch(request);
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
  }
};

export { MailboxDO } from '../workers/mailbox';
