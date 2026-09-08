import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Env } from './types';

const CERTS_PATH = '/cdn-cgi/access/certs';

let jwksCache: { url: string, jwks: ReturnType<typeof createRemoteJWKSet> } | undefined;

function jwksFor(url: URL) {
  if (jwksCache?.url !== url.href) {
    jwksCache = { url: url.href, jwks: createRemoteJWKSet(url) };
  }
  return jwksCache.jwks;
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
    // eslint-disable-next-line no-console
    console.error('Access JWT rejected:', (e as Error).message);
    return new Response('Invalid or expired Access token', { status: 403 });
  }
  return null;
}
