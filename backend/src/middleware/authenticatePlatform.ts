import type { NextFunction, Request, Response } from 'express';
import { unauthorized } from '../lib/errors.js';
import { verifyPlatformToken } from '../lib/jwt.js';

export interface PlatformAdminContext {
  id: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      platformAdmin?: PlatformAdminContext;
    }
  }
}

export function authenticatePlatform(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(unauthorized('MISSING_TOKEN', 'Token de autenticação ausente.'));
  }

  try {
    const payload = verifyPlatformToken(header.slice('Bearer '.length));
    req.platformAdmin = { id: payload.sub };
    next();
  } catch {
    next(unauthorized('INVALID_TOKEN', 'Token inválido ou expirado.'));
  }
}
