import { createRemoteJWKSet, jwtVerify } from 'jose';
import { logError } from '../shared/log';
import type { Env } from './types';

const CERTS_PATH = '/cdn-cgi/access/certs';

// Keyed by issuer URL: one JWKS per TEAM_DOMAIN, so switching env never
// serves the previous issuer's keys. Bounded by the number of issuers.
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function jwksFor(url: URL) {
  let jwks = jwksCache.get(url.href);
  if (jwks === undefined) {
    jwks = createRemoteJWKSet(url);
    jwksCache.set(url.href, jwks);
  }
  return jwks;
}

export async function accessMiddleware(request: Request, env: Env): Promise<Response | null> {
  if (import.meta.env.DEV) return null;
  if (new URL(request.url).pathname.startsWith('/api/v1/webhooks/')) {
    return null;
  }

  const { POLICY_AUD, TEAM_DOMAIN } = env;

  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) {
    return new Response('Missing required CF Access JWT', { status: 403 });
  }

  try {
    const team = new URL(TEAM_DOMAIN);
    const issuer = team.origin;
    const certsUrl = team.pathname.endsWith(CERTS_PATH) ? team : new URL(CERTS_PATH, issuer);
    await jwtVerify(token, jwksFor(certsUrl), {
      issuer,
      audience: POLICY_AUD
    });
  } catch (e) {
    logError('Access JWT rejected:', (e as Error).message);
    return new Response('Invalid or expired Access token', { status: 403 });
  }
  return null;
}
