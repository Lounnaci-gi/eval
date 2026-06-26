import { createHash, randomBytes } from 'crypto';

type TokenRecord = {
  id: string;
  tokenHash: string;
  userId: string;
  expiresAt: number;
  revoked?: boolean;
  replacedBy?: string | null;
  createdAt: number;
  lastUsedAt?: number;
};

// In-memory store (replace with DB for production)
const store = new Map<string, TokenRecord>();

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function saveRefreshToken({ userId, token, expiresDays = 30 }: { userId: string; token: string; expiresDays?: number }) {
  const id = randomBytes(12).toString('hex');
  const tokenHash = hashToken(token);
  const rec: TokenRecord = {
    id,
    tokenHash,
    userId,
    expiresAt: Date.now() + expiresDays * 24 * 60 * 60 * 1000,
    revoked: false,
    replacedBy: null,
    createdAt: Date.now(),
  };
  store.set(tokenHash, rec);
  return rec;
}

export async function findRefreshTokenByHash(hash: string) {
  return store.get(hash) || null;
}

export async function revokeTokenAndDescendants(hash: string, opts: { replacedBy?: string | null } = {}) {
  const rec = store.get(hash);
  if (!rec) return;
  rec.revoked = true;
  if (opts.replacedBy) rec.replacedBy = opts.replacedBy;
  store.set(hash, rec);
}

export async function revokeAllForUser(userId: string) {
  for (const [k, v] of store.entries()) {
    if (v.userId === userId) {
      v.revoked = true;
      store.set(k, v);
    }
  }
}

export function generateRefreshToken() {
  return randomBytes(48).toString('hex');
}
