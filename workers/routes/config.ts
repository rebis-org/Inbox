import { routing } from 'lemmih';
import type { App } from 'lemmih';
import { domains, emailAddresses } from '../config';
import { json } from '../http';
import type { Env } from '../types';

export function registerConfigRoutes(app: App, env: Env) {
  app.route(
    '/api/v1/config',
    routing.get(() => json({ domains: domains(env), emailAddresses: emailAddresses(env) }))
  );
}
