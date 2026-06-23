import { describe, expect, it } from 'vitest';
import { shortDate, TASK_STATUS_LABEL } from './notificationText.js';

describe('notificationText', () => {
  it('shortDate formata YYYY-MM-DD em "DD mês" (mesmo formato do frontend)', () => {
    expect(shortDate('2026-06-18')).toBe('18 jun');
    expect(shortDate('2026-01-05')).toBe('05 jan');
    expect(shortDate('2026-12-31')).toBe('31 dez');
  });

  it('TASK_STATUS_LABEL cobre todos os 9 valores de task_status', () => {
    const expected = ['na_fila', 'falta_captacao', 'em_edicao', 'no_servidor', 'em_aprovacao', 'em_alteracao', 'aprovado', 'reprovado', 'cancelado'];
    for (const status of expected) expect(TASK_STATUS_LABEL[status]).toBeTruthy();
  });
});
