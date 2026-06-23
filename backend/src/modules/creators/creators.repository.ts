import { and, asc, count, eq, inArray } from 'drizzle-orm';
import type { db as Db } from '../../db/client.js';
import { creators, users, type EmploymentType } from '../../db/schema/index.js';
import { rethrowAsConflictIfForeignKeyViolation } from '../../lib/dbErrors.js';
import { firstOrThrow } from '../../lib/firstOrThrow.js';
import type { Pagination } from '../../lib/pagination.js';

export interface CreatorView {
  id: string;
  tenantId: string;
  userId: string;
  employmentType: EmploymentType | null;
  active: boolean;
  createdAt: Date;
  name: string;
  email: string | null;
  phone: string | null;
}

export interface CreateCreatorRowInput {
  tenantId: string;
  userId: string;
  employmentType: EmploymentType;
  active?: boolean;
}

export interface UpdateCreatorRowInput {
  employmentType?: EmploymentType;
  active?: boolean;
}

function toView(row: { creators: typeof creators.$inferSelect; users: typeof users.$inferSelect }): CreatorView {
  return {
    id: row.creators.id,
    tenantId: row.creators.tenantId,
    userId: row.creators.userId,
    employmentType: row.creators.employmentType,
    active: row.creators.active,
    createdAt: row.creators.createdAt,
    name: row.users.name,
    email: row.users.email,
    phone: row.users.phone,
  };
}

export function createCreatorsRepository(db: typeof Db) {
  async function findRowById(tenantId: string, id: string) {
    const [row] = await db
      .select()
      .from(creators)
      .where(and(eq(creators.tenantId, tenantId), eq(creators.id, id)))
      .limit(1);
    return row ?? null;
  }

  async function findRowByUserId(tenantId: string, userId: string) {
    const [row] = await db
      .select()
      .from(creators)
      .where(and(eq(creators.tenantId, tenantId), eq(creators.userId, userId)))
      .limit(1);
    return row ?? null;
  }

  /** Mapeamento leve (sem JOIN/paginação) — usado por GET /users (admin) pra saber quem é Creator. */
  async function listIdsByTenant(tenantId: string) {
    return db.select({ id: creators.id, userId: creators.userId }).from(creators).where(eq(creators.tenantId, tenantId));
  }

  return {
    listIdsByTenant,
    findRowById,
    findRowByUserId,

    /** Ids dos creators ativos, ordenados por scale_order (drag na paleta da Escala) — base do
     * round-robin da escala automática. createdAt é só tiebreak (creators no mesmo scale_order,
     * ex.: nenhum foi reordenado ainda — default 0 em todos). */
    async listActiveIds(tenantId: string): Promise<string[]> {
      const rows = await db
        .select({ id: creators.id })
        .from(creators)
        .where(and(eq(creators.tenantId, tenantId), eq(creators.active, true)))
        .orderBy(asc(creators.scaleOrder), asc(creators.createdAt));
      return rows.map((r) => r.id);
    },

    /** Define a ordem (drag na paleta) — scale_order = índice no array enviado. Só atualiza ids que pertencem ao tenant. */
    async reorder(tenantId: string, orderedIds: string[]) {
      await db.transaction(async (tx) => {
        for (let i = 0; i < orderedIds.length; i++) {
          await tx.update(creators).set({ scaleOrder: i }).where(and(eq(creators.tenantId, tenantId), eq(creators.id, orderedIds[i]!)));
        }
      });
    },

    async list(tenantId: string, pagination: Pagination): Promise<{ rows: CreatorView[]; total: number }> {
      const where = eq(creators.tenantId, tenantId);

      const [rows, countRows] = await Promise.all([
        db
          .select()
          .from(creators)
          .innerJoin(users, eq(creators.userId, users.id))
          .where(where)
          .limit(pagination.limit)
          .offset(pagination.offset),
        db.select({ value: count() }).from(creators).where(where),
      ]);

      return { rows: rows.map(toView), total: firstOrThrow(countRows).value };
    },

    async findById(tenantId: string, id: string): Promise<CreatorView | null> {
      const [row] = await db
        .select()
        .from(creators)
        .innerJoin(users, eq(creators.userId, users.id))
        .where(and(eq(creators.tenantId, tenantId), eq(creators.id, id)))
        .limit(1);
      return row ? toView(row) : null;
    },

    /** Batch — usado por shifts.service.ts pra resolver nome do titular/sobreaviso (operacional não tem GET /creators). */
    async findNamesByIds(tenantId: string, ids: string[]): Promise<{ id: string; name: string }[]> {
      if (ids.length === 0) return [];
      const rows = await db
        .select({ id: creators.id, name: users.name })
        .from(creators)
        .innerJoin(users, eq(creators.userId, users.id))
        .where(and(eq(creators.tenantId, tenantId), inArray(creators.id, ids)));
      return rows;
    },

    async createRow(input: CreateCreatorRowInput) {
      const rows = await db
        .insert(creators)
        .values({
          tenantId: input.tenantId,
          userId: input.userId,
          employmentType: input.employmentType,
          active: input.active ?? true,
        })
        .returning();
      return firstOrThrow(rows);
    },

    async updateRow(tenantId: string, id: string, input: UpdateCreatorRowInput) {
      if (Object.keys(input).length === 0) return findRowById(tenantId, id);
      const rows = await db
        .update(creators)
        .set(input)
        .where(and(eq(creators.tenantId, tenantId), eq(creators.id, id)))
        .returning();
      return rows[0] ?? null;
    },

    /** Bloqueado pelo Postgres (ON DELETE RESTRICT) se houver task/serviço/escala/ausência/plantão vinculado. */
    async deleteRow(tenantId: string, id: string) {
      try {
        const rows = await db.delete(creators).where(and(eq(creators.tenantId, tenantId), eq(creators.id, id))).returning();
        return rows[0] ?? null;
      } catch (err) {
        rethrowAsConflictIfForeignKeyViolation(err, 'CREATOR_HAS_LINKED_RECORDS', 'Creator possui tarefas, serviços, escala, ausências ou plantões vinculados — não é possível excluir.');
      }
    },
  };
}

export type CreatorsRepository = ReturnType<typeof createCreatorsRepository>;
