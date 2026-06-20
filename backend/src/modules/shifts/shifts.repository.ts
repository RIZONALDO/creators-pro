import { and, count, eq } from 'drizzle-orm';
import type { db as Db } from '../../db/client.js';
import { shifts, type ShiftStatus } from '../../db/schema/index.js';
import { firstOrThrow } from '../../lib/firstOrThrow.js';
import type { Pagination } from '../../lib/pagination.js';

export interface CreateShiftInput {
  tenantId: string;
  shiftDate: string;
  creatorId?: string | null;
  notes?: string | null;
  status?: ShiftStatus;
  createdBy: string;
}

export interface UpdateShiftInput {
  shiftDate?: string;
  creatorId?: string | null;
  notes?: string | null;
}

export interface ShiftListFilter {
  creatorId?: string;
}

export function createShiftsRepository(db: typeof Db) {
  function whereFor(tenantId: string, filter?: ShiftListFilter) {
    const conditions = [eq(shifts.tenantId, tenantId)];
    if (filter?.creatorId) conditions.push(eq(shifts.creatorId, filter.creatorId));
    return and(...conditions);
  }

  async function findById(tenantId: string, id: string) {
    const [row] = await db.select().from(shifts).where(and(eq(shifts.tenantId, tenantId), eq(shifts.id, id))).limit(1);
    return row ?? null;
  }

  return {
    findById,

    async list(tenantId: string, pagination: Pagination, filter?: ShiftListFilter) {
      const where = whereFor(tenantId, filter);

      const [rows, countRows] = await Promise.all([
        db.select().from(shifts).where(where).limit(pagination.limit).offset(pagination.offset),
        db.select({ value: count() }).from(shifts).where(where),
      ]);

      return { rows, total: firstOrThrow(countRows).value };
    },

    async create(input: CreateShiftInput) {
      const rows = await db
        .insert(shifts)
        .values({
          tenantId: input.tenantId,
          shiftDate: input.shiftDate,
          creatorId: input.creatorId ?? null,
          notes: input.notes ?? null,
          status: input.status ?? 'pending',
          createdBy: input.createdBy,
        })
        .returning();
      return firstOrThrow(rows);
    },

    async update(tenantId: string, id: string, input: UpdateShiftInput) {
      if (Object.keys(input).length === 0) return findById(tenantId, id);
      const rows = await db
        .update(shifts)
        .set(input)
        .where(and(eq(shifts.tenantId, tenantId), eq(shifts.id, id)))
        .returning();
      return rows[0] ?? null;
    },

    async updateStatus(tenantId: string, id: string, status: ShiftStatus) {
      const rows = await db
        .update(shifts)
        .set({ status })
        .where(and(eq(shifts.tenantId, tenantId), eq(shifts.id, id)))
        .returning();
      return rows[0] ?? null;
    },
  };
}

export type ShiftsRepository = ReturnType<typeof createShiftsRepository>;
