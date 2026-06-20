import jwt from 'jsonwebtoken';
import { env } from './env.js';
import type { UserRole } from '../db/schema/index.js';

export interface AccessTokenPayload {
  sub: string; // user id
  tenant_id: string;
  role: UserRole;
}

const ACCESS_TOKEN_TTL = '15m';

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: ACCESS_TOKEN_TTL });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwtSecret) as AccessTokenPayload;
}
