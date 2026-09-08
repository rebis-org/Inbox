import { routing } from 'lemmih';
import type { App } from 'lemmih';
import type { Env } from '../types';
import { handleResendWebhook } from '../webhook';

export function registerWebhookRoutes(app: App, env: Env) {
  app.route(
    '/api/v1/webhooks/resend',
    routing.post((request) => handleResendWebhook(env, request))
  );
}
