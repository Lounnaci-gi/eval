// Minimal JWT helpers. Install dependency in project: `npm install jsonwebtoken`.
import jwt from 'jsonwebtoken';

const DEFAULT_DEV_SECRET = 'dev_access_secret_change_me';
const MIN_SECRET_LENGTH = 32;

function resolveSecret(): string {
  const raw = process.env.ACCESS_TOKEN_SECRET?.trim();
  const isProd = process.env.NODE_ENV === 'production';

  if (!raw) {
    if (isProd) {
      throw new Error(
        '[security] ACCESS_TOKEN_SECRET manquant. Définissez une valeur >= 32 caractères (ex: `openssl rand -hex 32`).'
      );
    }
    // En dev, on autorise un fallback explicite pour ne pas casser `npm run dev`,
    // mais on le loge clairement.
    console.warn(
      '[security] ACCESS_TOKEN_SECRET non défini — utilisation du secret de dev. Ne PAS déployer en prod.'
    );
    return DEFAULT_DEV_SECRET;
  }

  if (raw === DEFAULT_DEV_SECRET) {
    if (isProd) {
      throw new Error(
        '[security] ACCESS_TOKEN_SECRET utilise la valeur par défaut ("dev_access_secret_change_me"). Refusé en production.'
      );
    }
    console.warn(
      '[security] ACCESS_TOKEN_SECRET = valeur par défaut de dev détectée. Accepté uniquement en NODE_ENV !== "production".'
    );
  }

  if (raw.length < MIN_SECRET_LENGTH) {
    if (isProd) {
      throw new Error(
        `[security] ACCESS_TOKEN_SECRET trop court (${raw.length} caractères). Minimum requis : ${MIN_SECRET_LENGTH}.`
      );
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
