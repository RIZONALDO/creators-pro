import { and, eq } from 'drizzle-orm';
import type { db as Db } from '../../db/client.js';
import { scaleMonths } from '../../db/schema/index.js';
import { firstOrThrow } from '../../lib/firstOrThrow.js';

export interface CreateScaleMonthInput {
  tenantId: string;
  month: number;
  year: number;
  createdBy: string;
}

export function createScaleMonthsRepository(db: typeof Db) {
  return {
    async findByMonth(tenantId: string, month: number, year: number) {
      const [row] = await db
        .select()
        .from(scaleMonths)
        .where(and(eq(scaleMonths.tenantId, tenantId), eq(scaleMonths.month, month), eq(scaleMonths.year, year)))
        .limit(1);
      return row ?? null;
    },

    async findById(tenantId: string, id: string) {
      const [row] = await db
        .select()
        .from(scaleMonths)
        .where(and(eq(scaleMonths.tenantId, tenantId), eq(scaleMonths.id, id)))
        .limit(1);
      return row ?? null;
    },

    async create(input: CreateScaleMonthInput) {
      const rows = await db
        .insert(scaleMonths)
        .values({ tenantId: input.tenantId, month: input.month, year: input.year, createdBy: input.createdBy })
        .returning();
      return firstOrThrow(rows);
    },
  };
}

export type ScaleMonthsRepository = ReturnType<typeof createScaleMonthsRepository>;
