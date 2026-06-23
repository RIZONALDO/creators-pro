import { describe, expect, it } from 'vitest';
import { ApiError } from './errors.js';
import { rethrowAsConflictIfForeignKeyViolation } from './dbErrors.js';

describe('rethrowAsConflictIfForeignKeyViolation', () => {
  it('traduz erro de FK violation (code 23503) pra ApiError 409 com code/message dados', () => {
    const pgError = Object.assign(new Error('update or delete on table violates foreign key constraint'), { code: '23503' });

    expect(() => rethrowAsConflictIfForeignKeyViolation(pgError, 'CREATOR_HAS_LINKED_RECORDS', 'Creator possui registros vinculados.')).toThrow(ApiError);

    try {
      rethrowAsConflictIfForeignKeyViolation(pgError, 'CREATOR_HAS_LINKED_RECORDS', 'Creator possui registros vinculados.');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(409);
      expect((err as ApiError).code).toBe('CREATOR_HAS_LINKED_RECORDS');
    }
  });

  it('relança o erro original sem alterar se não for FK violation', () => {
    const otherError = new Error('algo completamente diferente');
    expect(() => rethrowAsConflictIfForeignKeyViolation(otherError, 'X', 'Y')).toThrow(otherError);
  });
});
