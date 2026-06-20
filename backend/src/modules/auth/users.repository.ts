import { eq } from 'drizzle-orm';
import type { db as Db } from '../../db/client.js';
import { firstOrThrow } from '../../lib/firstOrThrow.js';
import { users, type UserRole, type UserStatus } from '../../db/schema/index.js';

export interface CreateUserInput {
  tenantId: string;
  name: string;
  email: string;
  phone?: string | null;
  passwordHash: string;
  role: UserRole;
  status?: UserStatus;
}

export interface UpdateUserProfileInput {
  name?: string;
  email?: string;
  phone?: string | null;
}

export function createUsersRepository(db: typeof Db) {
  async function findById(id: string) {
    const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return row ?? null;
  }

  return {
    findById,

    async findByEmail(email: string) {
      const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      return row ?? null;
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
  };
}

export type UsersRepository = ReturnType<typeof createUsersRepository>;
