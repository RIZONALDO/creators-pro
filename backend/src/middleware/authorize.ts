import type { NextFunction, Request, Response } from 'express';
import { forbidden, unauthorized } from '../lib/errors.js';
import type { UserRole } from '../db/schema/index.js';

export function authorize(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(unauthorized('MISSING_TOKEN', 'Token de autenticação ausente.'));
    if (!roles.includes(req.auth.role)) {
      return next(forbidden('ROLE_NOT_ALLOWED', 'Seu perfil não tem permissão para esta ação.'));
    }
    next();
  };
}
