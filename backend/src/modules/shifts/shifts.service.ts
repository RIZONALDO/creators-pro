import type { db as Db } from '../../db/client.js';
import type { AuthContext } from '../../middleware/authenticate.js';
import { badRequest, notFound } from '../../lib/errors.js';
import type { Pagination } from '../../lib/pagination.js';
import { createCreatorsRepository } from '../creators/creators.repository.js';
import { createStatusHistoryRepository } from '../statusHistory/statusHistory.repository.js';
import { createShiftsRepository } from './shifts.repository.js';
import type { newShiftSchema, updateShiftSchema } from './shifts.schemas.js';
import type { ShiftStatus } from '../../db/schema/index.js';
import type { z } from 'zod';

export function createShiftsService(db: typeof Db) {
  const shiftsRepo = createShiftsRepository(db);
  const creatorsRepo = createCreatorsRepository(db);

  async function assertCreatorBelongsToTenant(tenantId: string, creatorId: string | null | undefined) {
    if (!creatorId) return;
    const row = await creatorsRepo.findRowById(tenantId, creatorId);
    if (!row) throw badRequest('INVALID_CREATOR', 'Creator inválido para este tenant.');
  }

  return {
    /** Plantões são só de creators (proposta original) — operacional só vê os próprios. */
    async list(auth: AuthContext, pagination: Pagination) {
      if (auth.role === 'operacional') {
        const creator = await creatorsRepo.findRowByUserId(auth.tenantId, auth.userId);
        if (!creator) return { rows: [], total: 0 };
        return shiftsRepo.list(auth.tenantId, pagination, { creatorId: creator.id });
      }
      return shiftsRepo.list(auth.tenantId, pagination);
    },

    async create(tenantId: string, createdBy: string, input: z.infer<typeof newShiftSchema>) {
      await assertCreatorBelongsToTenant(tenantId, input.creator_id);
      return shiftsRepo.create({
        tenantId,
        shiftDate: input.shift_date,
        creatorId: input.creator_id ?? null,
        notes: input.notes ?? null,
        status: input.status,
        createdBy,
      });
    },

    async update(tenantId: string, id: string, input: z.infer<typeof updateShiftSchema>) {
      await assertCreatorBelongsToTenant(tenantId, input.creator_id);
      const updated = await shiftsRepo.update(tenantId, id, {
        ...(input.shift_date !== undefined ? { shiftDate: input.shift_date } : {}),
        ...(input.creator_id !== undefined ? { creatorId: input.creator_id } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      });
      if (!updated) throw notFound('SHIFT_NOT_FOUND', 'Plantão não encontrado.');
      return updated;
    },

    async setStatus(tenantId: string, id: string, status: ShiftStatus, changedBy: string) {
      return db.transaction(async (tx) => {
        const txShiftsRepo = createShiftsRepository(tx as typeof Db);
        const txHistoryRepo = createStatusHistoryRepository(tx as typeof Db);

        const existing = await txShiftsRepo.findById(tenantId, id);
        if (!existing) throw notFound('SHIFT_NOT_FOUND', 'Plantão não encontrado.');

        const updated = await txShiftsRepo.updateStatus(tenantId, id, status);
        await txHistoryRepo.record({
          tenantId,
          entityType: 'shift',
          entityId: id,
          oldStatus: existing.status,
          newStatus: status,
          changedBy,
        });

        return updated;
      });
    },
  };
}

export type ShiftsService = ReturnType<typeof createShiftsService>;
