import { badRequest } from '../../lib/errors.js';

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function parseMonthParam(value: unknown): { year: number; month: number } {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) {
    throw badRequest('INVALID_MONTH', 'Parâmetro month deve estar no formato YYYY-MM.');
  }
  const [yearStr, monthStr] = value.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (month < 1 || month > 12) throw badRequest('INVALID_MONTH', 'Mês inválido.');
  return { year, month };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isValidDayInMonth(year: number, month: number, day: number): boolean {
  return day >= 1 && day <= daysInMonth(year, month);
}

export function buildDateStr(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** 0 = domingo, 6 = sábado (UTC, pra não depender do timezone do servidor). */
export function isWeekday(dateStr: string): boolean {
  const day = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return day !== 0 && day !== 6;
}

export function getWeekdaysInMonth(year: number, month: number): string[] {
  const total = daysInMonth(year, month);
  const dates: string[] = [];
  for (let day = 1; day <= total; day++) {
    const dateStr = buildDateStr(year, month, day);
    if (isWeekday(dateStr)) dates.push(dateStr);
  }
  return dates;
}

export function dayOfMonth(dateStr: string): number {
  return Number(dateStr.split('-')[2]);
}

export function isValidWorkDateFormat(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
