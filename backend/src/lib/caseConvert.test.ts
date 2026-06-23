import { describe, expect, it } from 'vitest';
import { toSnakeCase } from './caseConvert.js';

describe('toSnakeCase', () => {
  it('converte chaves camelCase pra snake_case recursivamente', () => {
    expect(toSnakeCase({ tenantId: '1', employmentType: 'fixed' })).toEqual({ tenant_id: '1', employment_type: 'fixed' });
  });

  it('não toca em chaves já snake_case', () => {
    expect(toSnakeCase({ scale_month_id: '1' })).toEqual({ scale_month_id: '1' });
  });

  it('não transforma VALORES, só chaves — código de erro em maiúsculas fica intacto', () => {
    expect(toSnakeCase({ error: { code: 'ABSENCE_OVERLAPS_SCHEDULE', message: 'x' } })).toEqual({
      error: { code: 'ABSENCE_OVERLAPS_SCHEDULE', message: 'x' },
    });
  });

  it('preserva instâncias de Date sem tentar iterar suas chaves', () => {
    const date = new Date('2026-06-18T12:00:00Z');
    const result = toSnakeCase({ createdAt: date }) as { created_at: Date };
    expect(result.created_at).toBe(date);
    expect(result.created_at.toISOString()).toBe('2026-06-18T12:00:00.000Z');
  });

  it('recursa em arrays de objetos', () => {
    expect(toSnakeCase([{ creatorId: 'a' }, { creatorId: 'b' }])).toEqual([{ creator_id: 'a' }, { creator_id: 'b' }]);
  });

  it('passa primitivos e null através sem alteração', () => {
    expect(toSnakeCase('texto')).toBe('texto');
    expect(toSnakeCase(42)).toBe(42);
    expect(toSnakeCase(null)).toBeNull();
    expect(toSnakeCase(undefined)).toBeUndefined();
  });
});
