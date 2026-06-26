// Minimal JWT helpers. Install dependency in project: `npm install jsonwebtoken`.
import jwt from 'jsonwebtoken';

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'dev_access_secret_change_me';
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
