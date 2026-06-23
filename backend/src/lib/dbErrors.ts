import { conflict } from './errors.js';

const FOREIGN_KEY_VIOLATION = '23503';

/** O driver `pg` lança um erro com `.code` = código do Postgres (não é uma classe exportada). */
function isForeignKeyViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === FOREIGN_KEY_VIOLATION;
}

/**
 * Usado em repositories de delete: se o DELETE falhar por FK (ON DELETE RESTRICT), traduz
 * pra um 409 com código/mensagem amigável em vez do erro cru do Postgres estourar como 500.
 */
export function rethrowAsConflictIfForeignKeyViolation(err: unknown, code: string, message: string): never {
  if (isForeignKeyViolation(err)) {
    throw conflict(code, message);
  }
  throw err;
}
