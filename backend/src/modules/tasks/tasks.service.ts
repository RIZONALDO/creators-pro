import type { db as Db } from '../../db/client.js';
import type { AuthContext } from '../../middleware/authenticate.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import type { Pagination } from '../../lib/pagination.js';
import { createNoopEmitter, type RealtimeEmitter } from '../../realtime/emitter.js';
import { createNoopPushSender, type PushSender } from '../../realtime/pushSender.js';
import { createAbsencesRepository } from '../absences/absences.repository.js';
import { createClientsRepository } from '../clients/clients.repository.js';
import { createCreatorsRepository } from '../creators/creators.repository.js';
import { createNotificationsService } from '../notifications/notifications.service.js';
import { createStatusHistoryRepository } from '../statusHistory/statusHistory.repository.js';
import { createTasksRepository } from './tasks.repository.js';
import type { newTaskSchema, updateTaskSchema } from './tasks.schemas.js';
import type { TaskStatus } from '../../db/schema/index.js';
import { TASK_STATUS_LABEL } from '../../lib/notificationText.js';
import type { z } from 'zod';

/** UTC, não o timezone do servidor — mesmo critério já usado em schedule.dates.ts#isWeekday. */
function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function createTasksService(
  db: typeof Db,
  emitter: RealtimeEmitter = createNoopEmitter(),
  pushSender: PushSender = createNoopPushSender(),
) {
  const tasksRepo = createTasksRepository(db);
  const creatorsRepo = createCreatorsRepository(db);
  const clientsRepo = createClientsRepository(db);
  const absencesRepo = createAbsencesRepository(db);
  const notificationsService = createNotificationsService(db, emitter, pushSender);

  async function assertCreatorBelongsToTenant(tenantId: string, creatorId: string | null | undefined) {
    if (!creatorId) return;
    const row = await creatorsRepo.findRowById(tenantId, creatorId);
    if (!row) throw badRequest('INVALID_CREATOR', 'Creator inválido para este tenant.');
    if (!row.active) throw badRequest('CREATOR_INACTIVE', 'Creator inativo não pode receber tarefas.');
  }

  async function assertClientBelongsToTenant(tenantId: string, clientId: string | null | undefined) {
    if (!clientId) return;
    const row = await clientsRepo.findById(tenantId, clientId);
    if (!row) throw badRequest('INVALID_CLIENT', 'Cliente inválido para este tenant.');
  }

  /** Não permite tarefa retroativa (data anterior a hoje) — limit-min-date, espelha o min do DatePicker no frontend. */
  function assertTaskDateNotInPast(taskDate: string | null | undefined) {
    if (!taskDate) return;
    if (taskDate < todayDateStr()) throw badRequest('TASK_DATE_IN_PAST', 'Não é possível usar uma data retroativa.');
  }

  /** Mesma regra de escala (assign/autoAssign): creator com ausência aprovada cobrindo a data não pode receber tarefa nessa data. */
  async function assertNoApprovedAbsenceOverlap(tenantId: string, creatorId: string | null | undefined, taskDate: string | null | undefined) {
    if (!creatorId || !taskDate) return;
    const overlapping = await absencesRepo.findApprovedOverlapping(tenantId, creatorId, taskDate);
    if (overlapping) throw conflict('ABSENCE_OVERLAPS_TASK', 'Creator possui ausência aprovada cobrindo essa data.');
  }

  return {
    /** operacional só vê as próprias tarefas (resolvido pelo creator vinculado ao seu user_id), nunca por um filtro vindo do client. */
    async list(auth: AuthContext, pagination: Pagination) {
      if (auth.role === 'operacional') {
        const creator = await creatorsRepo.findRowByUserId(auth.tenantId, auth.userId);
        if (!creator) return { rows: [], total: 0 };
        return tasksRepo.list(auth.tenantId, pagination, { creatorId: creator.id });
      }
      return tasksRepo.list(auth.tenantId, pagination);
    },

    async create(tenantId: string, createdBy: string, input: z.infer<typeof newTaskSchema>) {
      await assertCreatorBelongsToTenant(tenantId, input.creator_id);
      await assertClientBelongsToTenant(tenantId, input.client_id);
      assertTaskDateNotInPast(input.task_date);
      await assertNoApprovedAbsenceOverlap(tenantId, input.creator_id, input.task_date);

      const created = await tasksRepo.create({
        tenantId,
        title: input.title,
        formatType: input.format_type ?? null,
        taskDate: input.task_date ?? null,
        creatorId: input.creator_id ?? null,
        clientId: input.client_id ?? null,
        status: input.status,
        description: input.description ?? null,
        createdBy,
      });

      if (created.creatorId) {
        const creator = await creatorsRepo.findRowById(tenantId, created.creatorId);
        if (creator) await notificationsService.notify(tenantId, creator.userId, 'nova_tarefa', 'Nova tarefa', created.title);
      }

      return created;
    },

    async update(tenantId: string, id: string, input: z.infer<typeof updateTaskSchema>) {
      await assertCreatorBelongsToTenant(tenantId, input.creator_id);
      await assertClientBelongsToTenant(tenantId, input.client_id);
      assertTaskDateNotInPast(input.task_date);

      const existing = await tasksRepo.findById(tenantId, id);
      if (!existing) throw notFound('TASK_NOT_FOUND', 'Tarefa não encontrada.');

      // Só revalida ausência se creator OU data estão sendo de fato alterados nesta chamada — uma
      // tarefa que "ficou desatualizada" porque uma ausência foi aprovada depois não deve travar a
      // edição de outros campos (mesma filosofia de specs/06: não desfaz nada retroativamente, só
      // bloqueia uma NOVA combinação creator+data que já nasce em conflito).
      if (input.creator_id !== undefined || input.task_date !== undefined) {
        const effectiveCreatorId = input.creator_id !== undefined ? input.creator_id : existing.creatorId;
        const effectiveTaskDate = input.task_date !== undefined ? input.task_date : existing.taskDate;
        await assertNoApprovedAbsenceOverlap(tenantId, effectiveCreatorId, effectiveTaskDate);
      }

      const updated = await tasksRepo.update(tenantId, id, {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.format_type !== undefined ? { formatType: input.format_type } : {}),
        ...(input.task_date !== undefined ? { taskDate: input.task_date } : {}),
        ...(input.creator_id !== undefined ? { creatorId: input.creator_id } : {}),
        ...(input.client_id !== undefined ? { clientId: input.client_id } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      });
      if (!updated) throw notFound('TASK_NOT_FOUND', 'Tarefa não encontrada.');
      return updated;
    },

    async setStatus(tenantId: string, id: string, status: TaskStatus, changedBy: string) {
      const updated = await db.transaction(async (tx) => {
        const txTasksRepo = createTasksRepository(tx as typeof Db);
        const txHistoryRepo = createStatusHistoryRepository(tx as typeof Db);

        const existing = await txTasksRepo.findById(tenantId, id);
        if (!existing) throw notFound('TASK_NOT_FOUND', 'Tarefa não encontrada.');

        const updated = await txTasksRepo.updateStatus(tenantId, id, status);
        await txHistoryRepo.record({
          tenantId,
          entityType: 'task',
          entityId: id,
          oldStatus: existing.status,
          newStatus: status,
          changedBy,
        });

        return updated!;
      });

      // creator responsável + quem criou a tarefa (specs/06) — fora da transação: gatilho de
      // notificação não pode reverter a mudança de status se falhar por algum motivo.
      const recipientUserIds = new Set<string>(updated.createdBy ? [updated.createdBy] : []);
      if (updated.creatorId) {
        const creator = await creatorsRepo.findRowById(tenantId, updated.creatorId);
        if (creator) recipientUserIds.add(creator.userId);
      }
      for (const userId of recipientUserIds) {
        await notificationsService.notify(tenantId, userId, 'mudanca_status', 'Status da tarefa atualizado', `${updated.title} agora está em "${TASK_STATUS_LABEL[status] ?? status}"`);
      }

      return updated;
    },

    async remove(tenantId: string, id: string) {
      return db.transaction(async (tx) => {
        const txTasksRepo = createTasksRepository(tx as typeof Db);
        const txHistoryRepo = createStatusHistoryRepository(tx as typeof Db);

        const existing = await txTasksRepo.findById(tenantId, id);
        if (!existing) throw notFound('TASK_NOT_FOUND', 'Tarefa não encontrada.');

        await txHistoryRepo.deleteForEntity(tenantId, 'task', id);
        await txTasksRepo.delete(tenantId, id);
      });
    },
  };
}

export type TasksService = ReturnType<typeof createTasksService>;
