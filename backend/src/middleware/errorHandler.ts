import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { MulterError } from 'multer';
import { ApiError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) } });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: err.issues.map((i) => i.message).join('; ') },
    });
  }

  // upload/attachments: arquivo grande demais ou campo de arquivo errado não é erro interno, é input do usuário.
  if (err instanceof MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Arquivo maior que 25MB.' : err.message;
    return res.status(400).json({ error: { code: `UPLOAD_${err.code}`, message } });
  }

  logger.error('unhandled_error', {
    request_id: req.id,
    tenant_id: req.auth?.tenantId,
    user_id: req.auth?.userId,
    method: req.method,
    path: req.path,
    error: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : String(err),
  });
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erro interno.' } });
}
