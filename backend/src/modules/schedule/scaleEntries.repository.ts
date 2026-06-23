import { and, asc, between, eq } from 'drizzle-orm';
import type { db as Db } from '../../db/client.js';
import { scaleEntries } from '../../db/schema/index.js';

export interface NewScaleEntryRow {
  tenantId: string;
  scaleMonthId: string;
  workDate: string;
  creatorId?: string | null;
  isHoliday?: boolean;
}

export function createScaleEntriesRepository(db: typeof Db) {
  async function createMany(rows: NewScaleEntryRow[]) {
    if (rows.length === 0) return [];
    return db
      .insert(scaleEntries)
      .values(rows.map((r) => ({ tenantId: r.tenantId, scaleMonthId: r.scaleMonthId, workDate: r.workDate, creatorId: r.creatorId ?? null, isHoliday: r.isHoliday ?? false })))
      .returning();
  }

  return {
    listByMonth(tenantId: string, scaleMonthId: string) {
      return db
        .select()
        .from(scaleEntries)
        .where(and(eq(scaleEntries.tenantId, tenantId), eq(scaleEntries.scaleMonthId, scaleMonthId)))
        // 2º critério (createdAt) é necessário desde que mais de 1 creator por dia passou a ser
        // permitido — sem ele, o Postgres não garante ordem estável entre os vários creators de um
        // mesmo work_date, e duas telas que chamam o mesmo endpoint (Escala/Dashboard) podiam mostrar
        // ordens diferentes pro mesmo dia.
        .orderBy(asc(scaleEntries.workDate), asc(scaleEntries.createdAt));
    },

    /** Todos os creators já atribuídos num dia (0+, desde que mais de 1 por dia passou a ser permitido). */
    async listByWorkDate(tenantId: string, workDate: string) {
      return db
        .select()
        .from(scaleEntries)
        .where(and(eq(scaleEntries.tenantId, tenantId), eq(scaleEntries.workDate, workDate)));
    },

    /** Checagem de duplicidade antes de inserir — mesmo creator não pode ser atribuído 2x no mesmo dia. */
    async findByWorkDateAndCreator(tenantId: string, workDate: string, creatorId: string) {
      const [row] = await db
        .select()
        .from(scaleEntries)
        .where(and(eq(scaleEntries.tenantId, tenantId), eq(scaleEntries.workDate, workDate), eq(scaleEntries.creatorId, creatorId)))
        .limit(1);
      return row ?? null;
    },

    /** Base do gatilho 'alteracao_escala': dias em que o creator já estava escalado dentro do período de uma ausência aprovada. */
    async listByCreatorInRange(tenantId: string, creatorId: string, startDate: string, endDate: string) {
      return db
        .select()
        .from(scaleEntries)
        .where(and(eq(scaleEntries.tenantId, tenantId), eq(scaleEntries.creatorId, creatorId), between(scaleEntries.workDate, startDate, endDate)))
        .orderBy(asc(scaleEntries.workDate));
    },

    createMany,

    /** Atribuição única (1 creator, 1 dia) — usada pelo assign() manual. */
    async create(row: NewScaleEntryRow) {
      const [result] = await createMany([row]);
      return result!;
    },

    /** Remove 1 creator de 1 dia, sem afetar outros creators atribuídos no mesmo dia. */
    async deleteByWorkDateAndCreator(tenantId: string, workDate: string, creatorId: string) {
      const rows = await db
        .delete(scaleEntries)
        .where(and(eq(scaleEntries.tenantId, tenantId), eq(scaleEntries.workDate, workDate), eq(scaleEntries.creatorId, creatorId)))
        .returning();
      return rows[0] ?? null;
    },

    /** Limpa o mês inteiro antes de regenerar (autoAssign/duplicateMonth) — evita sobrar linha duplicada/obsoleta de uma rodada anterior. */
    async deleteByMonth(tenantId: string, scaleMonthId: string) {
      await db.delete(scaleEntries).where(and(eq(scaleEntries.tenantId, tenantId), eq(scaleEntries.scaleMonthId, scaleMonthId)));
    },
  };
}

export type ScaleEntriesRepository = ReturnType<typeof createScaleEntriesRepository>;
