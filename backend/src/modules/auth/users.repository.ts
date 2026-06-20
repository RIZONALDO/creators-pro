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

export function createUsersRepository(db: typeof Db) {
  return {
    async findByEmail(email: string) {
      const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      return row ?? null;
    },

    async findById(id: string) {
      const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
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
  };
}

export type UsersRepository = ReturnType<typeof createUsersRepository>;
