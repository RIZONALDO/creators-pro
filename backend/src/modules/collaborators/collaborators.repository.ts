import { and, count, eq } from 'drizzle-orm';
import type { db as Db } from '../../db/client.js';
import { collaborators, users, type EmploymentType } from '../../db/schema/index.js';
import { rethrowAsConflictIfForeignKeyViolation } from '../../lib/dbErrors.js';
import { firstOrThrow } from '../../lib/firstOrThrow.js';
import type { Pagination } from '../../lib/pagination.js';

export interface CollaboratorView {
  id: string;
  tenantId: string;
  userId: string;
  profession: string | null;
  employmentType: EmploymentType | null;
  active: boolean;
  createdAt: Date;
  name: string;
  email: string | null;
  phone: string | null;
}

export interface CreateCollaboratorRowInput {
  tenantId: string;
  userId: string;
  profession: string;
  employmentType: EmploymentType;
  active?: boolean;
}

export interface UpdateCollaboratorRowInput {
  profession?: string;
  employmentType?: EmploymentType;
  active?: boolean;
}

function toView(row: { collaborators: typeof collaborators.$inferSelect; users: typeof users.$inferSelect }): CollaboratorView {
  return {
    id: row.collaborators.id,
    tenantId: row.collaborators.tenantId,
    userId: row.collaborators.userId,
    profession: row.collaborators.profession,
    employmentType: row.collaborators.employmentType,
    active: row.collaborators.active,
    createdAt: row.collaborators.createdAt,
    name: row.users.name,
    email: row.users.email,
    phone: row.users.phone,
  };
}

export function createCollaboratorsRepository(db: typeof Db) {
  async function findRowById(tenantId: string, id: string) {
    const [row] = await db
      .select()
      .from(collaborators)
      .where(and(eq(collaborators.tenantId, tenantId), eq(collaborators.id, id)))
      .limit(1);
    return row ?? null;
  }

  async function findRowByUserId(tenantId: string, userId: string) {
    const [row] = await db
      .select()
      .from(collaborators)
      .where(and(eq(collaborators.tenantId, tenantId), eq(collaborators.userId, userId)))
      .limit(1);
    return row ?? null;
  }

  /** Mapeamento leve (sem JOIN/paginação) — usado por GET /users (admin) pra saber quem é Colaborador
   * e qual a profissão real cadastrada (texto mostrado na tela, não um rótulo genérico — specs/06). */
  async function listIdsByTenant(tenantId: string) {
    return db.select({ id: collaborators.id, userId: collaborators.userId, profession: collaborators.profession }).from(collaborators).where(eq(collaborators.tenantId, tenantId));
  }

  return {
    listIdsByTenant,
    findRowById,
    findRowByUserId,

    async list(tenantId: string, pagination: Pagination): Promise<{ rows: CollaboratorView[]; total: number }> {
      const where = eq(collaborators.tenantId, tenantId);

      const [rows, countRows] = await Promise.all([
        db
          .select()
          .from(collaborators)
          .innerJoin(users, eq(collaborators.userId, users.id))
          .where(where)
          .limit(pagination.limit)
          .offset(pagination.offset),
        db.select({ value: count() }).from(collaborators).where(where),
      ]);

      return { rows: rows.map(toView), total: firstOrThrow(countRows).value };
    },

    async findById(tenantId: string, id: string): Promise<CollaboratorView | null> {
      const [row] = await db
        .select()
        .from(collaborators)
        .innerJoin(users, eq(collaborators.userId, users.id))
        .where(and(eq(collaborators.tenantId, tenantId), eq(collaborators.id, id)))
        .limit(1);
      return row ? toView(row) : null;
    },

    async createRow(input: CreateCollaboratorRowInput) {
      const rows = await db
        .insert(collaborators)
        .values({
          tenantId: input.tenantId,
          userId: input.userId,
          profession: input.profession,
          employmentType: input.employmentType,
          active: input.active ?? true,
        })
        .returning();
      return firstOrThrow(rows);
    },

    async updateRow(tenantId: string, id: string, input: UpdateCollaboratorRowInput) {
      if (Object.keys(input).length === 0) return findRowById(tenantId, id);
      const rows = await db
        .update(collaborators)
        .set(input)
        .where(and(eq(collaborators.tenantId, tenantId), eq(collaborators.id, id)))
        .returning();
      return rows[0] ?? null;
    },

    /** Bloqueado pelo Postgres (ON DELETE RESTRICT) se houver serviço vinculado. */
    async deleteRow(tenantId: string, id: string) {
      try {
        const rows = await db.delete(collaborators).where(and(eq(collaborators.tenantId, tenantId), eq(collaborators.id, id))).returning();
        return rows[0] ?? null;
      } catch (err) {
        rethrowAsConflictIfForeignKeyViolation(err, 'COLLABORATOR_HAS_LINKED_RECORDS', 'Colaborador possui serviços vinculados — não é possível excluir.');
      }
    },
  };
}

export type CollaboratorsRepository = ReturnType<typeof createCollaboratorsRepository>;
