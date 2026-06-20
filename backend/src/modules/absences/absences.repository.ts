import { and, count, eq, lte, gte } from 'drizzle-orm';
import type { db as Db } from '../../db/client.js';
import { absences, type AbsenceStatus } from '../../db/schema/index.js';
import { firstOrThrow } from '../../lib/firstOrThrow.js';
import type { Pagination } from '../../lib/pagination.js';

export interface CreateAbsenceInput {
  tenantId: string;
  creatorId: string;
  startDate: string;
  endDate: string;
  reason?: string | null;
}

export interface AbsenceListFilter {
  creatorId?: string;
}

export function createAbsencesRepository(db: typeof Db) {
  function whereFor(tenantId: string, filter?: AbsenceListFilter) {
    const conditions = [eq(absences.tenantId, tenantId)];
    if (filter?.creatorId) conditions.push(eq(absences.creatorId, filter.creatorId));
    return and(...conditions);
  }

  async function findById(tenantId: string, id: string) {
    const [row] = await db.select().from(absences).where(and(eq(absences.tenantId, tenantId), eq(absences.id, id))).limit(1);
    return row ?? null;
  }

  return {
    findById,

    async list(tenantId: string, pagination: Pagination, filter?: AbsenceListFilter) {
      const where = whereFor(tenantId, filter);

      const [rows, countRows] = await Promise.all([
        db.select().from(absences).where(where).limit(pagination.limit).offset(pagination.offset),
        db.select({ value: count() }).from(absences).where(where),
      ]);

      return { rows, total: firstOrThrow(countRows).value };
    },

    async create(input: CreateAbsenceInput) {
      const rows = await db
        .insert(absences)
        .values({
          tenantId: input.tenantId,
          creatorId: input.creatorId,
          startDate: input.startDate,
          endDate: input.endDate,
          reason: input.reason ?? null,
        })
        .returning();
      return firstOrThrow(rows);
    },

    async review(tenantId: string, id: string, status: AbsenceStatus, approvedBy: string) {
      const rows = await db
        .update(absences)
        .set({ status, approvedBy, approvedAt: new Date() })
        .where(and(eq(absences.tenantId, tenantId), eq(absences.id, id)))
        .returning();
      return rows[0] ?? null;
    },

    /** Base da validação cruzada Escala↔Ausências da Fase 4b — ausência aprovada cobrindo a data. */
    async findApprovedOverlapping(tenantId: string, creatorId: string, date: string) {
      const [row] = await db
        .select()
        .from(absences)
        .where(
          and(
            eq(absences.tenantId, tenantId),
            eq(absences.creatorId, creatorId),
            eq(absences.status, 'approved'),
            lte(absences.startDate, date),
            gte(absences.endDate, date),
          ),
        )
        .limit(1);
      return row ?? null;
    },
  };
}

export type AbsencesRepository = ReturnType<typeof createAbsencesRepository>;
