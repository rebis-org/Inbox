import { App } from 'lemmih';
import { cors } from 'lemmih/cors';
import type { Env } from './types';
import { createRouteContext } from './routes/context';
import { registerAttachmentRoutes } from './routes/attachments';
import { registerConfigRoutes } from './routes/config';
import { registerEmailRoutes } from './routes/emails';
import { registerFolderRoutes } from './routes/folders';
import { registerMailboxRoutes } from './routes/mailboxes';
import { registerSearchRoutes } from './routes/search';
import { registerThreadRoutes } from './routes/threads';
import { registerWebhookRoutes } from './routes/webhooks';

const ALLOWED_METHODS = ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'];

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

function allowOrigin(origin: string | null): string | undefined {
  if (!origin || !import.meta.env.DEV) return undefined;
  const url = URL.parse(origin);
  return url && LOCAL_HOSTS.has(url.hostname) ? origin : undefined;
}

function sameOriginOrNull(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin || request.method === 'GET' || request.method === 'HEAD') return true;
  const originUrl = URL.parse(origin);
  return originUrl !== null && originUrl.host === new URL(request.url).host;
}

function scrubError(error: unknown): string {
  if (!(error instanceof Error)) return 'Unknown error';
  return `${error.name}: ${error.message.split('params:', 2)[0].slice(0, 300)}`;
}

export function apiFetch(
  request: Request,
  env: Env,
  execution: ExecutionContext,
  ssr: (request: Request) => Response | Promise<Response>
): Promise<Response> {
  if (!import.meta.env.DEV && !sameOriginOrNull(request)) {
    return Promise.resolve(new Response('Forbidden', { status: 403 }));
  }
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
      console.error('API error:', scrubError(e));
      return new Response('Internal Server Error', { status: 500 });
    }
  });
  registerRoutes(app, env, execution);
  return app.fetch(request);
}

function registerRoutes(app: App, env: Env, execution: ExecutionContext): void {
  const ctx = createRouteContext(env, execution);
  registerConfigRoutes(app, env);
  registerWebhookRoutes(app, env);
  registerMailboxRoutes(app, ctx);
  registerEmailRoutes(app, ctx);
  registerThreadRoutes(app, ctx);
  registerFolderRoutes(app, ctx);
  registerSearchRoutes(app, ctx);
  registerAttachmentRoutes(app, ctx);
}
