import { randomBytes, createHash } from 'crypto';

export function generateCsrfToken() {
  return randomBytes(24).toString('hex');
}

export function verifyCsrf(cookieToken: string | null, headerToken: string | null) {
  if (!cookieToken || !headerToken) return false;
  // Use constant-time comparison
  const cHash = createHash('sha256').update(cookieToken).digest('hex');
  const hHash = createHash('sha256').update(headerToken).digest('hex');
  return cHash === hHash;
}
