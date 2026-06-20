import { and, eq, gte, isNull, lte, or } from 'drizzle-orm';
import type { db as Db } from '../../db/client.js';
import { holidays } from '../../db/schema/index.js';
import { firstOrThrow } from '../../lib/firstOrThrow.js';
import { buildDateStr, daysInMonth } from './schedule.dates.js';

export interface CreateHolidayInput {
  tenantId: string;
  holidayDate: string;
  description?: string | null;
}

export function createHolidaysRepository(db: typeof Db) {
  async function findGlobalByDate(holidayDate: string) {
    const [row] = await db.select().from(holidays).where(and(isNull(holidays.tenantId), eq(holidays.holidayDate, holidayDate))).limit(1);
    return row ?? null;
  }

  return {
    findGlobalByDate,

    /** Globais (tenant_id NULL) + específicos do tenant, dentro do mês informado. */
    async listForMonth(tenantId: string, year: number, month: number) {
      const start = buildDateStr(year, month, 1);
      const end = buildDateStr(year, month, daysInMonth(year, month));
      return db
        .select()
        .from(holidays)
        .where(and(or(eq(holidays.tenantId, tenantId), isNull(holidays.tenantId)), gte(holidays.holidayDate, start), lte(holidays.holidayDate, end)));
    },

    async create(input: CreateHolidayInput) {
      const rows = await db
        .insert(holidays)
        .values({ tenantId: input.tenantId, holidayDate: input.holidayDate, description: input.description ?? null })
        .returning();
      return firstOrThrow(rows);
    },

    /** Idempotente — usado pelo seed de feriados nacionais (tenant_id NULL). */
    async createGlobal(holidayDate: string, description: string) {
      const existing = await findGlobalByDate(holidayDate);
      if (existing) return existing;
      const rows = await db.insert(holidays).values({ tenantId: null, holidayDate, description }).returning();
      return firstOrThrow(rows);
    },
  };
}

export type HolidaysRepository = ReturnType<typeof createHolidaysRepository>;
