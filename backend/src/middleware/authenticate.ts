import type { NextFunction, Request, Response } from 'express';
import { unauthorized } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/jwt.js';
import type { UserRole } from '../db/schema/index.js';

export interface AuthContext {
  userId: string;
  tenantId: string;
  role: UserRole;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(unauthorized('MISSING_TOKEN', 'Token de autenticação ausente.'));
  }

  try {
    const payload = verifyAccessToken(header.slice('Bearer '.length));
    req.auth = { userId: payload.sub, tenantId: payload.tenant_id, role: payload.role };
    next();
  } catch {
    next(unauthorized('INVALID_TOKEN', 'Token inválido ou expirado.'));
  }
}
