import { and, count, eq } from 'drizzle-orm';
import type { db as Db } from '../../db/client.js';
import { clients, creatorTasks, type TaskFormat, type TaskStatus } from '../../db/schema/index.js';
import { firstOrThrow } from '../../lib/firstOrThrow.js';
import type { Pagination } from '../../lib/pagination.js';

export interface CreateTaskInput {
  tenantId: string;
  title: string;
  formatType?: TaskFormat | null;
  taskDate?: string | null;
  creatorId?: string | null;
  clientId?: string | null;
  status?: TaskStatus;
  description?: string | null;
  createdBy: string;
}

export interface UpdateTaskInput {
  title?: string;
  formatType?: TaskFormat | null;
  taskDate?: string | null;
  creatorId?: string | null;
  clientId?: string | null;
  description?: string | null;
}

export interface TaskListFilter {
  creatorId?: string;
}

export function createTasksRepository(db: typeof Db) {
  function whereFor(tenantId: string, filter?: TaskListFilter) {
    const conditions = [eq(creatorTasks.tenantId, tenantId)];
    if (filter?.creatorId) conditions.push(eq(creatorTasks.creatorId, filter.creatorId));
    return and(...conditions);
  }

  async function findById(tenantId: string, id: string) {
    const [row] = await db
      .select()
      .from(creatorTasks)
      .where(and(eq(creatorTasks.tenantId, tenantId), eq(creatorTasks.id, id)))
      .limit(1);
    return row ?? null;
  }

  return {
    findById,

    /**
     * client_name vem via LEFT JOIN: o operacional não tem acesso a GET /clients (RBAC), então
     * sem isso a tela dele (cards de tarefa) não teria como mostrar o nome do cliente.
     */
    async list(tenantId: string, pagination: Pagination, filter?: TaskListFilter) {
      const where = whereFor(tenantId, filter);

      const [rows, countRows] = await Promise.all([
        db
          .select({
            id: creatorTasks.id,
            tenantId: creatorTasks.tenantId,
            title: creatorTasks.title,
            formatType: creatorTasks.formatType,
            taskDate: creatorTasks.taskDate,
            creatorId: creatorTasks.creatorId,
            clientId: creatorTasks.clientId,
            clientName: clients.name,
            status: creatorTasks.status,
            description: creatorTasks.description,
            createdBy: creatorTasks.createdBy,
            createdAt: creatorTasks.createdAt,
            updatedAt: creatorTasks.updatedAt,
          })
          .from(creatorTasks)
          .leftJoin(clients, eq(creatorTasks.clientId, clients.id))
          .where(where)
          .limit(pagination.limit)
          .offset(pagination.offset),
        db.select({ value: count() }).from(creatorTasks).where(where),
      ]);

      return { rows, total: firstOrThrow(countRows).value };
    },

    async create(input: CreateTaskInput) {
      const rows = await db
        .insert(creatorTasks)
        .values({
          tenantId: input.tenantId,
          title: input.title,
          formatType: input.formatType ?? null,
          taskDate: input.taskDate ?? null,
          creatorId: input.creatorId ?? null,
          clientId: input.clientId ?? null,
          status: input.status ?? 'na_fila',
          description: input.description ?? null,
          createdBy: input.createdBy,
        })
        .returning();
      return firstOrThrow(rows);
    },

    async update(tenantId: string, id: string, input: UpdateTaskInput) {
      if (Object.keys(input).length === 0) return findById(tenantId, id);
      const rows = await db
        .update(creatorTasks)
        .set({ ...input, updatedAt: new Date() })
        .where(and(eq(creatorTasks.tenantId, tenantId), eq(creatorTasks.id, id)))
        .returning();
      return rows[0] ?? null;
    },

    async updateStatus(tenantId: string, id: string, status: TaskStatus) {
      const rows = await db
        .update(creatorTasks)
        .set({ status, updatedAt: new Date() })
        .where(and(eq(creatorTasks.tenantId, tenantId), eq(creatorTasks.id, id)))
        .returning();
      return rows[0] ?? null;
    },

    /** Nada referencia creator_tasks.id como FK — apagar é sempre permitido (depois de limpar o próprio histórico, no service). */
    async delete(tenantId: string, id: string) {
      const rows = await db.delete(creatorTasks).where(and(eq(creatorTasks.tenantId, tenantId), eq(creatorTasks.id, id))).returning();
      return rows.length > 0;
    },
  };
}

export type TasksRepository = ReturnType<typeof createTasksRepository>;
