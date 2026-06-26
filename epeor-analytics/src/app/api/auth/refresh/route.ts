import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { findRefreshTokenByHash, generateRefreshToken, saveRefreshToken, revokeTokenAndDescendants } from '../../../../lib/refreshTokens';
import { signAccessToken } from '../../../../lib/jwt';
import { buildSetCookieRefresh, buildClearRefreshCookie } from '../../../../utils/cookies';
import { verifyCsrf } from '../../../../lib/csrf';

export async function POST(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') || '';
  const m = cookieHeader.split(';').map(c=>c.trim()).find(c=>c.startsWith('refresh_token='));
  const token = m ? decodeURIComponent(m.split('=')[1]) : null;
  // CSRF protection: require x-csrf-token header equals csrf_token cookie
  const csrfCookie = cookieHeader.split(';').map(c=>c.trim()).find(c=>c.startsWith('csrf_token='));
  const csrfCookieVal = csrfCookie ? decodeURIComponent(csrfCookie.split('=')[1]) : null;
  const headerCsrf = req.headers.get('x-csrf-token');
  if (!verifyCsrf(csrfCookieVal, headerCsrf)) return new Response(JSON.stringify({ error: 'CSRF check failed' }), { status: 403 });
  if (!token) return new Response(JSON.stringify({ error: 'No refresh token' }), { status: 401 });

  const incomingHash = createHash('sha256').update(token).digest('hex');
  const rec = await findRefreshTokenByHash(incomingHash);
  if (!rec || rec.revoked || rec.expiresAt < Date.now()) {
    if (rec && rec.revoked) {
      // possible reuse — revoke all for user
      await revokeTokenAndDescendants(incomingHash);
    }
    return new Response(JSON.stringify({ error: 'Invalid refresh token' }), { status: 401 });
  }

  // rotate
  const newToken = generateRefreshToken();
  const newRec = await saveRefreshToken({ userId: rec.userId, token: newToken, expiresDays: 30 });
  await revokeTokenAndDescendants(incomingHash, { replacedBy: newRec.id });

  const accessToken = signAccessToken({ userId: rec.userId });
  const setCookie = buildSetCookieRefresh(newToken, 30);

  return new Response(JSON.stringify({ accessToken }), { status: 200, headers: { 'Set-Cookie': setCookie, 'Content-Type': 'application/json' } });
}
