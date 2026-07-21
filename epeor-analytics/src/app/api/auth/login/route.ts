import { NextRequest } from 'next/server';
import { signAccessToken } from '../../../../lib/jwt';
import { generateRefreshToken, saveRefreshToken } from '../../../../lib/refreshTokens';
import { buildSetCookieRefresh, buildSetCsrfCookie } from '../../../../utils/cookies';
import { consumeAttempt } from '../../../../lib/rateLimit';
import { z } from 'zod';
import { generateCsrfToken } from '../../../../lib/csrf';
import { apiUrl } from '../../../lib/api';

const loginSchema = z.object({
  username: z.string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_]+$/, "Le nom d'utilisateur ne doit contenir que des lettres, chiffres et tirets bas (_)"),
  password: z.string()
    .min(8)
    .max(128)
    .refine(val => !/<[a-zA-Z/]/i.test(val) && !/javascript:/i.test(val), {
      message: "Le mot de passe contient des caractères ou structures non autorisés (anti-XSS)",
    }),
});

const BACKEND_INTERNAL_TIMEOUT_MS = 5000;

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = consumeAttempt(`login:${ip}`);
  if (!rl.ok) {
    return new Response(JSON.stringify({ error: 'Too many attempts' }), {
      status: 429,
      headers: { 'Retry-After': String(rl.retryAfter ?? 60) },
    });
  }

  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    const detail = parsed.error.issues[0]?.message || 'Saisie invalide';
    return new Response(JSON.stringify({ detail }), { status: 400 });
  }

  const { username, password } = parsed.data;

  // Proxy la vérification réelle au backend FastAPI (PBKDF2 + users.db).
  // On ne renvoie jamais au client un message qui distingue "user inconnu" / "mauvais mot de passe".
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BACKEND_INTERNAL_TIMEOUT_MS);

  let backendRes: Response;
  try {
    backendRes = await fetch(apiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch {
    clearTimeout(timeout);
    return new Response(JSON.stringify({ error: 'Auth backend unavailable' }), { status: 503 });
  }
  clearTimeout(timeout);

  if (!backendRes.ok) {
    return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 });
  }

  const backendData = (await backendRes.json().catch(() => null)) as { status?: string; username?: string } | null;
  const authenticatedUsername = backendData?.username?.toLowerCase();
  if (!authenticatedUsername) {
    return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 });
  }

  const userId = `user-${authenticatedUsername}`;
  const accessToken = signAccessToken({ userId, username: authenticatedUsername });

  const refreshToken = generateRefreshToken();
  await saveRefreshToken({ userId, token: refreshToken, expiresDays: 30 });

  const setCookie = buildSetCookieRefresh(refreshToken, 30);
  const csrfToken = generateCsrfToken();
  const setCsrf = buildSetCsrfCookie(csrfToken, 30);

  const responseHeaders: Record<string, string> = {
    'Set-Cookie': [setCookie, setCsrf].join(', '),
    'Content-Type': 'application/json',
  };

  // Propage le cookie de session backend (HttpOnly) si présent.
  const setCookieBackend = backendRes.headers.get('set-cookie');
  if (setCookieBackend) {
    responseHeaders['Set-Cookie'] = `${responseHeaders['Set-Cookie']}, ${setCookieBackend}`;
  }

  return new Response(JSON.stringify({ accessToken, csrfToken }), {
    status: 200,
    headers: responseHeaders,
  });
}
