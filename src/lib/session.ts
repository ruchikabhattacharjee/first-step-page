import jwt from 'jsonwebtoken';

/**
 * Signing secret for session JWTs.
 * In production a real JWT_SECRET is mandatory — falling back to a well-known
 * string would let anyone mint a valid session cookie. In dev we allow a
 * fixed fallback so the app runs without any .env setup.
 */
export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length > 0) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is not set. Configure it before running in production.');
  }
  return 'dev-only-insecure-secret';
}

export type SessionPayload = { userId: string; email: string; role: string };

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, jwtSecret(), { expiresIn: '7d' });
}

/** Standard session cookie string (7 days, HttpOnly). */
export function sessionCookie(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `auth_token=${token}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax${secure}`;
}
