// Minimal JWT helpers. Install dependency in project: `npm install jsonwebtoken`.
import { randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';

const DEFAULT_DEV_SECRET = 'dev_access_secret_change_me';
const MIN_SECRET_LENGTH = 32;
const FALLBACK_SECRET = randomBytes(32).toString('hex');

function resolveSecret(): string {
  const raw = process.env.ACCESS_TOKEN_SECRET?.trim();
  const isProd = process.env.NODE_ENV === 'production';
  const isBuild = process.env.NEXT_PHASE === 'phase-production-build' || process.env.VERCEL === '1';

  if (!raw) {
    const fallbackSecret = process.env.JWT_SECRET?.trim() || FALLBACK_SECRET;
    if (isProd && !isBuild) {
      console.warn(
        '[security] ACCESS_TOKEN_SECRET non défini — utilisation d’un secret de secours temporaire pour la session courante.'
      );
    } else {
      console.warn(
        '[security] ACCESS_TOKEN_SECRET non défini — utilisation d’un secret de secours temporaire. À définir explicitement pour un environnement stable.'
      );
    }
    return fallbackSecret;
  }

  if (raw === DEFAULT_DEV_SECRET) {
    if (isProd) {
      console.warn(
        '[security] ACCESS_TOKEN_SECRET utilise la valeur par défaut de dev. Le secret de secours temporaire sera utilisé jusqu’à ce qu’une valeur réelle soit fournie.'
      );
      return FALLBACK_SECRET;
    }
    console.warn(
      '[security] ACCESS_TOKEN_SECRET = valeur par défaut de dev détectée. Accepté uniquement en NODE_ENV !== "production".'
    );
  }

  if (raw.length < MIN_SECRET_LENGTH) {
    if (isProd) {
      console.warn(
        `[security] ACCESS_TOKEN_SECRET trop court (${raw.length} caractères). Utilisation d’un secret de secours temporaire.`
      );
      return FALLBACK_SECRET;
    }
    console.warn(
      `[security] ACCESS_TOKEN_SECRET trop court (${raw.length} caractères). Recommandé : >= ${MIN_SECRET_LENGTH}.`
    );
  }

  return raw;
}

const ACCESS_TOKEN_SECRET = resolveSecret();
const ACCESS_TOKEN_EXPIRES = '15m';

export function signAccessToken(payload: object) {
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES });
}

export function verifyAccessToken(token: string) {
  try {
    return jwt.verify(token, ACCESS_TOKEN_SECRET) as any;
  } catch (e) {
    throw e;
  }
}
