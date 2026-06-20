import { createHash, randomBytes } from 'node:crypto';

export function generateOpaqueToken(): string {
  return randomBytes(32).toString('hex');
}

// sha256 (não bcrypt): refresh token precisa de lookup determinístico por igualdade no banco.
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
