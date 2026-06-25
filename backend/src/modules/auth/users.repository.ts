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
  // null = conta 'pending' (convite só com e-mail) — login só via Google até alguém definir senha.
  passwordHash: string | null;
  role: UserRole;
  status?: UserStatus;
  alias?: string | null;
  // hash do token de convite — só preenchido quando passwordHash é null (conta pending). Ver
  // creators.service.ts/collaborators.service.ts#create e auth.service.ts#claimInviteWithGoogle.
  inviteTokenHash?: string | null;
}

export interface LinkGoogleProfileInput {
  googleId?: string;
  name?: string;
  avatarUrl?: string;
  status?: UserStatus;
  // null pra invalidar o token depois do claim (uso único) — ver claimInviteWithGoogle.
  inviteTokenHash?: string | null;
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

    /** Usado pelo claim de convite (POST /auth/google/claim) — busca por hash, nunca pelo token cru. */
    async findByInviteTokenHash(hash: string) {
      const [row] = await db.select().from(users).where(eq(users.inviteTokenHash, hash)).limit(1);
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
          inviteTokenHash: input.inviteTokenHash ?? null,
        })
        .returning();
      return firstOrThrow(rows);
    },

    /** Gera um novo link de convite (gestor perdeu/não copiou o anterior) — substitui o hash
     * salvo, então o token antigo (se ainda existir em algum lugar) deixa de funcionar. Usado só
     * em conta 'pending' (ver creators.service.ts/collaborators.service.ts#regenerateInvite). */
    async regenerateInviteToken(id: string, inviteTokenHash: string) {
      const rows = await db.update(users).set({ inviteTokenHash }).where(eq(users.id, id)).returning();
      return firstOrThrow(rows);
    },

    /** Aplicado só no primeiro login com Google de uma conta — vincula google_id e, se a conta
     * estava 'pending' (convite só com e-mail), captura nome/foto reais do Google e ativa. Em conta
     * já 'active' (criada do jeito antigo, com senha), só vincula google_id como credencial extra —
     * nunca sobrescreve nome já cadastrado. Ver auth.service.ts#loginWithGoogle.
     * Só chamado com `input` não-vazio (o caller já garante isso) — sem caso especial de "nada pra
     * atualizar" aqui, pra não devolver `Row | null` quando o id é sabidamente válido. */
    async linkGoogleProfile(id: string, input: LinkGoogleProfileInput) {
      const patch: Partial<typeof users.$inferInsert> = {};
      if (input.googleId !== undefined) patch.googleId = input.googleId;
      if (input.name !== undefined) patch.name = input.name;
      if (input.avatarUrl !== undefined) patch.avatarUrl = input.avatarUrl;
      if (input.status !== undefined) patch.status = input.status;
      if (input.inviteTokenHash !== undefined) patch.inviteTokenHash = input.inviteTokenHash;

      const rows = await db.update(users).set(patch).where(eq(users.id, id)).returning();
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

    /** Reset de senha — usado por creators/collaborators ao editar o usuário vinculado. Conta
     * 'pending' (convite só com e-mail, sem senha) que ganha uma senha de verdade aqui passa a
     * 'active' — senão o gestor define a senha e a pessoa continua sem conseguir entrar (login()
     * só libera status 'active'). Conta 'inactive' não é reativada por isso (desativação é decisão
     * explícita do admin, resetar senha não deve desfazer). */
    async updatePassword(id: string, passwordHash: string) {
      const current = await findById(id);
      const patch: Partial<typeof users.$inferInsert> = { passwordHash };
      if (current?.status === 'pending') patch.status = 'active';

      const rows = await db.update(users).set(patch).where(eq(users.id, id)).returning();
      return firstOrThrow(rows);
    },

    /** Tenant-scoped — usado pelo módulo admin de /users (gerenciar admin/gestor diretamente;
     * operacional nunca aparece aqui, é gerenciado em Cadastros pelo próprio gestor). */
    async listByTenant(tenantId: string, pagination: Pagination, roles: UserRole[]) {
      const where = and(eq(users.tenantId, tenantId), inArray(users.role, roles));

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
