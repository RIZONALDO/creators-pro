import { and, count, eq, inArray } from 'drizzle-orm';
import type { db as Db } from '../../db/client.js';
import { rethrowAsConflictIfForeignKeyViolation } from '../../lib/dbErrors.js';
import { firstOrThrow } from '../../lib/firstOrThrow.js';
import type { Pagination } from '../../lib/pagination.js';
import { users, type UserRole, type UserStatus } from '../../db/schema/index.js';

export interface CreateUserInput {
  tenantId: string;
  name: string;
  email: string;
  phone?: string | null;
  passwordHash: string;
  role: UserRole;
  status?: UserStatus;
  alias?: string | null;
}

export interface UpdateUserProfileInput {
  name?: string;
  email?: string;
  phone?: string | null;
}

export interface UpdateUserAdminInput {
  name?: string;
  email?: string;
  phone?: string | null;
  role?: UserRole;
  status?: UserStatus;
  alias?: string | null;
}

export function createUsersRepository(db: typeof Db) {
  async function findById(id: string) {
    const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return row ?? null;
  }

  async function findByIdInTenant(tenantId: string, id: string) {
    const [row] = await db.select().from(users).where(and(eq(users.tenantId, tenantId), eq(users.id, id))).limit(1);
    return row ?? null;
  }

  return {
    findById,
    findByIdInTenant,

    async findByEmail(email: string) {
      const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      return row ?? null;
    },

    /** Usado pelos gatilhos de notificação 'alteracao_escala' — avisa todo coordenador do tenant. */
    async findIdsByRoles(tenantId: string, roles: UserRole[]) {
      const rows = await db.select({ id: users.id }).from(users).where(and(eq(users.tenantId, tenantId), inArray(users.role, roles)));
      return rows.map((r) => r.id);
    },

    /** Usado por GET /messages/contacts — quem o operacional pode contatar (a coordenação). */
    async findByRoles(tenantId: string, roles: UserRole[]) {
      return db.select({ id: users.id, name: users.name }).from(users).where(and(eq(users.tenantId, tenantId), inArray(users.role, roles)));
    },

    async create(input: CreateUserInput) {
      const rows = await db
        .insert(users)
        .values({
          tenantId: input.tenantId,
          name: input.name,
          email: input.email,
          phone: input.phone ?? null,
          passwordHash: input.passwordHash,
          role: input.role,
          status: input.status ?? 'active',
          alias: input.alias ?? null,
        })
        .returning();
      return firstOrThrow(rows);
    },

    /** Atualiza só os campos informados (name/email/phone) — usado por creators/collaborators ao editar o usuário vinculado. */
    async updateProfile(id: string, input: UpdateUserProfileInput) {
      const patch: Partial<typeof users.$inferInsert> = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.email !== undefined) patch.email = input.email;
      if (input.phone !== undefined) patch.phone = input.phone;

      if (Object.keys(patch).length === 0) return findById(id);

      const rows = await db.update(users).set(patch).where(eq(users.id, id)).returning();
      return firstOrThrow(rows);
    },

    /** Reset de senha — usado por creators/collaborators ao editar o usuário vinculado. */
    async updatePassword(id: string, passwordHash: string) {
      const rows = await db.update(users).set({ passwordHash }).where(eq(users.id, id)).returning();
      return firstOrThrow(rows);
    },

    /** Tenant-scoped — usado pelo módulo admin de /users (gerenciar coordenadores/operacionais diretamente). */
    async listByTenant(tenantId: string, pagination: Pagination) {
      const where = eq(users.tenantId, tenantId);

      const [rows, countRows] = await Promise.all([
        db.select().from(users).where(where).limit(pagination.limit).offset(pagination.offset),
        db.select({ value: count() }).from(users).where(where),
      ]);

      return { rows, total: firstOrThrow(countRows).value };
    },

    /** Tenant-scoped — só o admin do próprio tenant pode mudar role/status de um usuário. */
    async updateAdmin(tenantId: string, id: string, input: UpdateUserAdminInput) {
      const patch: Partial<typeof users.$inferInsert> = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.email !== undefined) patch.email = input.email;
      if (input.phone !== undefined) patch.phone = input.phone;
      if (input.role !== undefined) patch.role = input.role;
      if (input.status !== undefined) patch.status = input.status;
      if (input.alias !== undefined) patch.alias = input.alias;

      if (Object.keys(patch).length === 0) return findByIdInTenant(tenantId, id);

      const rows = await db
        .update(users)
        .set(patch)
        .where(and(eq(users.tenantId, tenantId), eq(users.id, id)))
        .returning();
      return rows[0] ?? null;
    },

    /** Tenant-scoped. Usado pelo /users admin e por creators/collaborators ao apagar o usuário vinculado. */
    async deleteById(tenantId: string, id: string) {
      try {
        const rows = await db.delete(users).where(and(eq(users.tenantId, tenantId), eq(users.id, id))).returning();
        return rows.length > 0;
      } catch (err) {
        rethrowAsConflictIfForeignKeyViolation(err, 'USER_HAS_LINKED_RECORDS', 'Usuário possui registros vinculados — não é possível excluir.');
      }
    },
  };
}

export type UsersRepository = ReturnType<typeof createUsersRepository>;
