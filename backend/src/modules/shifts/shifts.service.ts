import type { db as Db } from '../../db/client.js';
import type { AuthContext } from '../../middleware/authenticate.js';
import { badRequest, notFound } from '../../lib/errors.js';
import type { Pagination } from '../../lib/pagination.js';
import { createNoopEmitter, type RealtimeEmitter } from '../../realtime/emitter.js';
import { createNoopPushSender, type PushSender } from '../../realtime/pushSender.js';
import { createCreatorsRepository } from '../creators/creators.repository.js';
import { createNotificationsService } from '../notifications/notifications.service.js';
import { createStatusHistoryRepository } from '../statusHistory/statusHistory.repository.js';
import { createShiftsRepository } from './shifts.repository.js';
import { createShiftStandbysRepository } from './shiftStandbys.repository.js';
import type { newShiftSchema, updateShiftSchema } from './shifts.schemas.js';
import type { ShiftStatus } from '../../db/schema/index.js';
import { shortDate } from '../../lib/notificationText.js';
import type { z } from 'zod';

export function createShiftsService(
  db: typeof Db,
  emitter: RealtimeEmitter = createNoopEmitter(),
  pushSender: PushSender = createNoopPushSender(),
) {
  const shiftsRepo = createShiftsRepository(db);
  const shiftStandbysRepo = createShiftStandbysRepository(db);
  const creatorsRepo = createCreatorsRepository(db);
  const notificationsService = createNotificationsService(db, emitter, pushSender);

  async function assertCreatorBelongsToTenant(tenantId: string, creatorId: string | null | undefined) {
    if (!creatorId) return;
    const row = await creatorsRepo.findRowById(tenantId, creatorId);
    if (!row) throw badRequest('INVALID_CREATOR', 'Creator inválido para este tenant.');
  }

  async function assertCreatorsBelongToTenant(tenantId: string, creatorIds: string[] | undefined) {
    if (!creatorIds) return;
    for (const creatorId of creatorIds) await assertCreatorBelongsToTenant(tenantId, creatorId);
  }

  /** Sobreaviso recebe a mesma notificação 'novo_plantao' do plantonista titular — só o título distingue o papel. */
  async function notifyShiftAssignment(tenantId: string, creatorId: string, shiftDate: string, isStandby: boolean) {
    const creator = await creatorsRepo.findRowById(tenantId, creatorId);
    if (!creator) return;
    const title = isStandby ? 'Sobreaviso de plantão' : 'Novo plantão';
    await notificationsService.notify(tenantId, creator.userId, 'novo_plantao', title, shortDate(shiftDate));
  }

  /** Acrescenta standby_creator_ids + nomes (titular e sobreaviso) — operacional não tem GET
   * /creators (RBAC), então sem isso a tela dele só conseguiria mostrar o próprio nome, nunca o de
   * quem é titular/sobreaviso num plantão em que ele aparece como o outro papel. */
  async function withStandbys<T extends { id: string; creatorId: string | null }>(
    tenantId: string,
    rows: T[],
  ): Promise<(T & { standbyCreatorIds: string[]; creatorName: string | null; standbyNames: string[] })[]> {
    const standbyRows = await shiftStandbysRepo.listByShiftIds(tenantId, rows.map((r) => r.id));
    const standbyIdsByShift = new Map<string, string[]>();
    for (const s of standbyRows) standbyIdsByShift.set(s.shiftId, [...(standbyIdsByShift.get(s.shiftId) ?? []), s.creatorId]);

    const allCreatorIds = new Set<string>();
    for (const r of rows) if (r.creatorId) allCreatorIds.add(r.creatorId);
    for (const ids of standbyIdsByShift.values()) for (const id of ids) allCreatorIds.add(id);
    const nameRows = await creatorsRepo.findNamesByIds(tenantId, [...allCreatorIds]);
    const nameById = new Map(nameRows.map((c) => [c.id, c.name]));

    return rows.map((r) => {
      const standbyCreatorIds = standbyIdsByShift.get(r.id) ?? [];
      return {
        ...r,
        standbyCreatorIds,
        creatorName: r.creatorId ? nameById.get(r.creatorId) ?? null : null,
        standbyNames: standbyCreatorIds.map((id) => nameById.get(id) ?? 'Creator'),
      };
    });
  }

  return {
    /** Plantões são só de creators (proposta original) — operacional só vê os próprios. */
    async list(auth: AuthContext, pagination: Pagination) {
      const { rows, total } =
        auth.role === 'operacional'
          ? await (async () => {
              const creator = await creatorsRepo.findRowByUserId(auth.tenantId, auth.userId);
              if (!creator) return { rows: [], total: 0 };
              return shiftsRepo.list(auth.tenantId, pagination, { creatorId: creator.id });
            })()
          : await shiftsRepo.list(auth.tenantId, pagination);

      return { rows: await withStandbys(auth.tenantId, rows), total };
    },

    async create(tenantId: string, createdBy: string, input: z.infer<typeof newShiftSchema>) {
      await assertCreatorBelongsToTenant(tenantId, input.creator_id);
      await assertCreatorsBelongToTenant(tenantId, input.standby_creator_ids);

      const created = await shiftsRepo.create({
        tenantId,
        shiftDate: input.shift_date,
        creatorId: input.creator_id ?? null,
        notes: input.notes ?? null,
        status: input.status,
        createdBy,
      });

      const standbyCreatorIds = [...new Set(input.standby_creator_ids ?? [])];
      if (standbyCreatorIds.length > 0) await shiftStandbysRepo.setStandbys(tenantId, created.id, standbyCreatorIds);

      if (created.creatorId) await notifyShiftAssignment(tenantId, created.creatorId, created.shiftDate, false);
      for (const creatorId of standbyCreatorIds) await notifyShiftAssignment(tenantId, creatorId, created.shiftDate, true);

      const [enriched] = await withStandbys(tenantId, [created]);
      return enriched!;
    },

    async update(tenantId: string, id: string, input: z.infer<typeof updateShiftSchema>) {
      await assertCreatorBelongsToTenant(tenantId, input.creator_id);
      await assertCreatorsBelongToTenant(tenantId, input.standby_creator_ids);

      const existing = await shiftsRepo.findById(tenantId, id);
      if (!existing) throw notFound('SHIFT_NOT_FOUND', 'Plantão não encontrado.');

      const updated = await shiftsRepo.update(tenantId, id, {
        ...(input.shift_date !== undefined ? { shiftDate: input.shift_date } : {}),
        ...(input.creator_id !== undefined ? { creatorId: input.creator_id } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      });
      if (!updated) throw notFound('SHIFT_NOT_FOUND', 'Plantão não encontrado.');

      // Notifica o novo plantonista titular só se de fato mudou — evita reenviar em toda edição não relacionada (ex.: só mudar notes).
      if (input.creator_id !== undefined && input.creator_id && input.creator_id !== existing.creatorId) {
        await notifyShiftAssignment(tenantId, input.creator_id, updated.shiftDate, false);
      }

      if (input.standby_creator_ids !== undefined) {
        const currentIds = (await shiftStandbysRepo.listByShiftIds(tenantId, [id])).map((r) => r.creatorId);
        const nextIds = [...new Set(input.standby_creator_ids)];
        const newlyAdded = nextIds.filter((cid) => !currentIds.includes(cid));
        await shiftStandbysRepo.setStandbys(tenantId, id, nextIds);
        for (const creatorId of newlyAdded) await notifyShiftAssignment(tenantId, creatorId, updated.shiftDate, true);
      }

      const [enriched] = await withStandbys(tenantId, [updated]);
      return enriched!;
    },

    async setStatus(tenantId: string, id: string, status: ShiftStatus, changedBy: string) {
      const updated = await db.transaction(async (tx) => {
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

      // standby_creator_ids/nomes precisam vir junto mesmo aqui — senão o frontend, que substitui o
      // shift inteiro pela resposta, perderia essa info ao só trocar o status.
      const [enriched] = await withStandbys(tenantId, [updated!]);
      return enriched!;
    },

    async remove(tenantId: string, id: string) {
      return db.transaction(async (tx) => {
        const txShiftsRepo = createShiftsRepository(tx as typeof Db);
        const txHistoryRepo = createStatusHistoryRepository(tx as typeof Db);

        const existing = await txShiftsRepo.findById(tenantId, id);
        if (!existing) throw notFound('SHIFT_NOT_FOUND', 'Plantão não encontrado.');

        await txHistoryRepo.deleteForEntity(tenantId, 'shift', id);
        await txShiftsRepo.delete(tenantId, id);
        // shift_standbys some via ON DELETE CASCADE — não precisa de uma 3ª chamada aqui.
      });
    },
  };
}

export type ShiftsService = ReturnType<typeof createShiftsService>;
