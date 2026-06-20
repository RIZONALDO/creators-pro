import type { db as Db } from '../../db/client.js';
import type { AuthContext } from '../../middleware/authenticate.js';
import { badRequest, notFound } from '../../lib/errors.js';
import type { Pagination } from '../../lib/pagination.js';
import { createClientsRepository } from '../clients/clients.repository.js';
import { createCreatorsRepository } from '../creators/creators.repository.js';
import { createStatusHistoryRepository } from '../statusHistory/statusHistory.repository.js';
import { createTasksRepository } from './tasks.repository.js';
import type { newTaskSchema, updateTaskSchema } from './tasks.schemas.js';
import type { TaskStatus } from '../../db/schema/index.js';
import type { z } from 'zod';

export function createTasksService(db: typeof Db) {
  const tasksRepo = createTasksRepository(db);
  const creatorsRepo = createCreatorsRepository(db);
  const clientsRepo = createClientsRepository(db);

  async function assertCreatorBelongsToTenant(tenantId: string, creatorId: string | null | undefined) {
    if (!creatorId) return;
    const row = await creatorsRepo.findRowById(tenantId, creatorId);
    if (!row) throw badRequest('INVALID_CREATOR', 'Creator inválido para este tenant.');
  }

  async function assertClientBelongsToTenant(tenantId: string, clientId: string | null | undefined) {
    if (!clientId) return;
    const row = await clientsRepo.findById(tenantId, clientId);
    if (!row) throw badRequest('INVALID_CLIENT', 'Cliente inválido para este tenant.');
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

      return tasksRepo.create({
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
    },

    async update(tenantId: string, id: string, input: z.infer<typeof updateTaskSchema>) {
      await assertCreatorBelongsToTenant(tenantId, input.creator_id);
      await assertClientBelongsToTenant(tenantId, input.client_id);

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
      return db.transaction(async (tx) => {
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

        return updated;
      });
    },
  };
}

export type TasksService = ReturnType<typeof createTasksService>;
