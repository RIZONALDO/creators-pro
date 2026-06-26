import { and, count, eq } from 'drizzle-orm';
import type { db as Db } from '../../db/client.js';
import { collaborators, type EmploymentType } from '../../db/schema/index.js';
import { rethrowAsConflictIfForeignKeyViolation } from '../../lib/dbErrors.js';
import { firstOrThrow } from '../../lib/firstOrThrow.js';
import type { Pagination } from '../../lib/pagination.js';

export interface CollaboratorView {
  id: string;
  tenantId: string;
  name: string;
  email: string | null;
  phone: string | null;
  profession: string | null;
  employmentType: EmploymentType | null;
  active: boolean;
  createdAt: Date;
}

export interface CreateCollaboratorRowInput {
  tenantId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  profession: string;
  employmentType: EmploymentType;
  active?: boolean;
}

export interface UpdateCollaboratorRowInput {
  name?: string;
  email?: string | null;
  phone?: string | null;
  profession?: string;
  employmentType?: EmploymentType;
  active?: boolean;
}

function toView(row: typeof collaborators.$inferSelect): CollaboratorView {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    email: row.email ?? null,
    phone: row.phone ?? null,
    profession: row.profession ?? null,
    employmentType: row.employmentType ?? null,
    active: row.active,
    createdAt: row.createdAt,
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

  return {
    findRowById,

    async list(tenantId: string, pagination: Pagination): Promise<{ rows: CollaboratorView[]; total: number }> {
      const where = eq(collaborators.tenantId, tenantId);
      const [rows, countRows] = await Promise.all([
        db.select().from(collaborators).where(where).limit(pagination.limit).offset(pagination.offset),
        db.select({ value: count() }).from(collaborators).where(where),
      ]);
      return { rows: rows.map(toView), total: firstOrThrow(countRows).value };
    },

    async findById(tenantId: string, id: string): Promise<CollaboratorView | null> {
      const row = await findRowById(tenantId, id);
      return row ? toView(row) : null;
    },

    async createRow(input: CreateCollaboratorRowInput): Promise<CollaboratorView> {
      const rows = await db
        .insert(collaborators)
        .values({
          tenantId: input.tenantId,
          name: input.name,
          email: input.email ?? null,
          phone: input.phone ?? null,
          profession: input.profession,
          employmentType: input.employmentType,
          active: input.active ?? true,
        })
        .returning();
      return toView(firstOrThrow(rows));
    },

    async updateRow(tenantId: string, id: string, input: UpdateCollaboratorRowInput): Promise<CollaboratorView | null> {
      if (Object.keys(input).length === 0) return findRowById(tenantId, id).then((r) => (r ? toView(r) : null));
      const rows = await db
        .update(collaborators)
        .set(input)
        .where(and(eq(collaborators.tenantId, tenantId), eq(collaborators.id, id)))
        .returning();
      return rows[0] ? toView(rows[0]) : null;
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
