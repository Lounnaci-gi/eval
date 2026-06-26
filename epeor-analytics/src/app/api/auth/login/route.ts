import { NextRequest } from 'next/server';
import { signAccessToken } from '../../../../lib/jwt';
import { generateRefreshToken, saveRefreshToken } from '../../../../lib/refreshTokens';
import { buildSetCookieRefresh, buildSetCsrfCookie } from '../../../../utils/cookies';
import { consumeAttempt } from '../../../../lib/rateLimit';
import { z } from 'zod';
import { generateCsrfToken } from '../../../../lib/csrf';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const rl = consumeAttempt(`login:${ip}`);
  if (!rl.ok) return new Response(JSON.stringify({ error: 'Too many attempts' }), { status: 429 });

  const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });
  const body = await req.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return new Response(JSON.stringify({ error: 'Invalid input' }), { status: 400 });

  const { email, password } = parsed.data;
  // TODO: Replace with real user lookup and password verify (bcrypt)
  if (password !== 'password123') {
    return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 });
  }

  const userId = 'user-' + email;
  const accessToken = signAccessToken({ userId });

  const refreshToken = generateRefreshToken();
  await saveRefreshToken({ userId, token: refreshToken, expiresDays: 30 });

  const setCookie = buildSetCookieRefresh(refreshToken, 30);
  const csrfToken = generateCsrfToken();
  const setCsrf = buildSetCsrfCookie(csrfToken, 30);

  // return csrfToken as well so client can read and store (double-submit)
  return new Response(JSON.stringify({ accessToken, csrfToken }), { status: 200, headers: { 'Set-Cookie': [setCookie, setCsrf].join('; '), 'Content-Type': 'application/json' } });
}
