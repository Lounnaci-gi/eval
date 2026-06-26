import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { revokeTokenAndDescendants } from '../../../../lib/refreshTokens';
import { buildClearRefreshCookie } from '../../../../utils/cookies';

export async function POST(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') || '';
  const m = cookieHeader.split(';').map(c=>c.trim()).find(c=>c.startsWith('refresh_token='));
  const token = m ? decodeURIComponent(m.split('=')[1]) : null;
  // verify csrf for logout
  const csrfCookie = cookieHeader.split(';').map(c=>c.trim()).find(c=>c.startsWith('csrf_token='));
  const csrfCookieVal = csrfCookie ? decodeURIComponent(csrfCookie.split('=')[1]) : null;
  const headerCsrf = req.headers.get('x-csrf-token');
  const { verifyCsrf } = await import('../../../../lib/csrf');
  if (!verifyCsrf(csrfCookieVal, headerCsrf)) return new Response(JSON.stringify({ error: 'CSRF check failed' }), { status: 403 });
  if (token) {
    const hash = createHash('sha256').update(token).digest('hex');
    await revokeTokenAndDescendants(hash);
  }
  const clear = buildClearRefreshCookie();
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Set-Cookie': clear, 'Content-Type': 'application/json' } });
}
