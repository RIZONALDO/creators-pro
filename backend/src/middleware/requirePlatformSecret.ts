import type { NextFunction, Request, Response } from 'express';
import { env } from '../lib/env.js';
import { unauthorized } from '../lib/errors.js';

/** Protege rotas internas (/internal/*) — nunca expostas a usuários finais. Ver specs/03. */
export function requirePlatformSecret(req: Request, _res: Response, next: NextFunction) {
  const secret = req.headers['x-platform-secret'];
  if (secret !== env.platformProvisionSecret) {
    return next(unauthorized('INVALID_PLATFORM_SECRET', 'Secret de plataforma inválido.'));
  }
  next();
}
