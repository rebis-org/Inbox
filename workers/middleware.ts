import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Env } from './types';

const CERTS_PATH = '/cdn-cgi/access/certs';

export async function accessMiddleware(request: Request, env: Env): Promise<Response | null> {
  if (import.meta.env.DEV) return null;
  if (new URL(request.url).pathname.startsWith('/api/v1/webhooks/')) {
    return null;
  }

  const { POLICY_AUD, TEAM_DOMAIN } = env;
  if (!POLICY_AUD || !TEAM_DOMAIN) {
    return new Response(
      'Cloudflare Access must be configured in production. Set POLICY_AUD and TEAM_DOMAIN.',
      { status: 500 }
    );
  }

  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) {
    return new Response('Missing required CF Access JWT', { status: 403 });
  }

  let expectedIssuer = '(invalid TEAM_DOMAIN)';
  try {
    const team = new URL(TEAM_DOMAIN);
    const issuer = team.origin;
    expectedIssuer = issuer;
    const certsUrl = team.pathname.endsWith(CERTS_PATH) ? team : new URL(CERTS_PATH, issuer);
    await jwtVerify(token, createRemoteJWKSet(certsUrl), {
      issuer,
      audience: POLICY_AUD
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      'Access JWT rejected:',
      (e as Error).message,
      '| expected issuer:',
      expectedIssuer,
      '| expected aud:',
      POLICY_AUD ? `${POLICY_AUD.slice(0, 12)}…` : '(empty)',
      '| TEAM_DOMAIN:',
      TEAM_DOMAIN || '(empty)'
    );
    return new Response('Invalid or expired Access token', { status: 403 });
  }
  return null;
}
