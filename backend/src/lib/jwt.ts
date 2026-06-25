import jwt from 'jsonwebtoken';
import { env } from './env.js';
import type { UserRole } from '../db/schema/index.js';

export interface AccessTokenPayload {
  sub: string; // user id
  tenant_id: string;
  role: UserRole;
}

// Campo `scope` distingue tokens de plataforma de tokens de tenant — incompatíveis por design.
export interface PlatformTokenPayload {
  sub: string; // superadmin id
  scope: 'platform';
}

const ACCESS_TOKEN_TTL = '15m';
const PLATFORM_TOKEN_TTL = '2h';

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: ACCESS_TOKEN_TTL });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwtSecret) as AccessTokenPayload;
}

export function signPlatformToken(payload: PlatformTokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: PLATFORM_TOKEN_TTL });
}

export function verifyPlatformToken(token: string): PlatformTokenPayload {
  const decoded = jwt.verify(token, env.jwtSecret) as PlatformTokenPayload;
  if (decoded.scope !== 'platform') throw new Error('Token não é de plataforma.');
  return decoded;
}
