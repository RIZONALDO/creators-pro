import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { logger } from '../lib/logger.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

/**
 * Atribui `req.id` (correlação) e loga 1 linha por requisição ao finalizar — método, rota, status,
 * duração e, quando autenticado (roda depois de `authenticate` na ordem de chegada do `finish`,
 * não na de registro do middleware), `tenant_id`/`user_id`.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  req.id = randomUUID();
  const start = Date.now();

  res.on('finish', () => {
    logger.info('request', {
      request_id: req.id,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: Date.now() - start,
      tenant_id: req.auth?.tenantId,
      user_id: req.auth?.userId,
    });
  });

  next();
}
