import { describe, expect, it } from 'vitest';
import { daysInMonth, getWeekdaysInMonth, isValidDayInMonth, isWeekday, parseMonthParam } from './schedule.dates.js';

describe('schedule.dates', () => {
  it('parseMonthParam aceita YYYY-MM e rejeita formato inválido', () => {
    expect(parseMonthParam('2026-06')).toEqual({ year: 2026, month: 6 });
    expect(() => parseMonthParam('2026/06')).toThrow();
    expect(() => parseMonthParam('2026-13')).toThrow();
    expect(() => parseMonthParam(undefined)).toThrow();
  });

  it('daysInMonth conta corretamente, incluindo fevereiro bissexto', () => {
    expect(daysInMonth(2026, 6)).toBe(30);
    expect(daysInMonth(2026, 1)).toBe(31);
    expect(daysInMonth(2024, 2)).toBe(29); // bissexto
    expect(daysInMonth(2026, 2)).toBe(28);
  });

  it('isWeekday identifica sábado/domingo corretamente', () => {
    expect(isWeekday('2026-06-19')).toBe(true); // sexta
    expect(isWeekday('2026-06-20')).toBe(false); // sábado
    expect(isWeekday('2026-06-21')).toBe(false); // domingo
    expect(isWeekday('2026-06-22')).toBe(true); // segunda
  });

  it('getWeekdaysInMonth de junho/2026 tem 22 dias úteis e nenhum sábado/domingo', () => {
    const days = getWeekdaysInMonth(2026, 6);
    expect(days).toHaveLength(22);
    expect(days.every(isWeekday)).toBe(true);
    expect(days[0]).toBe('2026-06-01');
    expect(days.at(-1)).toBe('2026-06-30');
  });

  it('isValidDayInMonth rejeita dia 31 em junho', () => {
    expect(isValidDayInMonth(2026, 6, 30)).toBe(true);
    expect(isValidDayInMonth(2026, 6, 31)).toBe(false);
    expect(isValidDayInMonth(2026, 6, 0)).toBe(false);
  });
});
