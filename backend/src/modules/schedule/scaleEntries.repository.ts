import { and, asc, eq } from 'drizzle-orm';
import type { db as Db } from '../../db/client.js';
import { scaleEntries } from '../../db/schema/index.js';
import { firstOrThrow } from '../../lib/firstOrThrow.js';

export interface NewScaleEntryRow {
  tenantId: string;
  scaleMonthId: string;
  workDate: string;
  creatorId?: string | null;
  isHoliday?: boolean;
}

export function createScaleEntriesRepository(db: typeof Db) {
  return {
    async listByMonth(tenantId: string, scaleMonthId: string) {
      return db
        .select()
        .from(scaleEntries)
        .where(and(eq(scaleEntries.tenantId, tenantId), eq(scaleEntries.scaleMonthId, scaleMonthId)))
        .orderBy(asc(scaleEntries.workDate));
    },

    async findByWorkDate(tenantId: string, workDate: string) {
      const [row] = await db
        .select()
        .from(scaleEntries)
        .where(and(eq(scaleEntries.tenantId, tenantId), eq(scaleEntries.workDate, workDate)))
        .limit(1);
      return row ?? null;
    },

    async createMany(rows: NewScaleEntryRow[]) {
      if (rows.length === 0) return [];
      return db
        .insert(scaleEntries)
        .values(rows.map((r) => ({ tenantId: r.tenantId, scaleMonthId: r.scaleMonthId, workDate: r.workDate, creatorId: r.creatorId ?? null, isHoliday: r.isHoliday ?? false })))
        .returning();
    },

    /** Upsert por (tenant_id, work_date) — usado tanto pela atribuição manual quanto pela escala automática/duplicação. */
    async upsertAssignment(input: { tenantId: string; scaleMonthId: string; workDate: string; creatorId: string | null; isHoliday: boolean }) {
      const rows = await db
        .insert(scaleEntries)
        .values({
          tenantId: input.tenantId,
          scaleMonthId: input.scaleMonthId,
          workDate: input.workDate,
          creatorId: input.creatorId,
          isHoliday: input.isHoliday,
        })
        .onConflictDoUpdate({
          target: [scaleEntries.tenantId, scaleEntries.workDate],
          set: { creatorId: input.creatorId, isHoliday: input.isHoliday },
        })
        .returning();
      return firstOrThrow(rows);
    },
  };
}

export type ScaleEntriesRepository = ReturnType<typeof createScaleEntriesRepository>;
