// Very small in-memory rate limiter. Use Redis in production.
const attempts = new Map<string, { count: number; first: number }>();

export function consumeAttempt(key: string, limit = 5, windowSec = 900) {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec) {
    attempts.set(key, { count: 1, first: now });
    return { ok: true };
  }
  if (now - rec.first > windowSec * 1000) {
    attempts.set(key, { count: 1, first: now });
    return { ok: true };
  }
  rec.count += 1;
  attempts.set(key, rec);
  if (rec.count > limit) return { ok: false, retryAfter: Math.ceil((windowSec*1000 - (now - rec.first))/1000) };
  return { ok: true };
}
