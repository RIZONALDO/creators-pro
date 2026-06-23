import type { NextFunction, Request, Response } from 'express';
import { toSnakeCase } from '../lib/caseConvert.js';

/** Intercepta res.json pra converter toda resposta de camelCase (Drizzle) para snake_case (contrato do frontend). */
export function snakeCaseResponse(_req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json.bind(res);
  res.json = ((body?: unknown) => originalJson(toSnakeCase(body))) as Response['json'];
  next();
}
