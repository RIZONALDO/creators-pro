import { and, count, eq } from 'drizzle-orm';
import type { db as Db } from '../../db/client.js';
import { clients } from '../../db/schema/index.js';
import { firstOrThrow } from '../../lib/firstOrThrow.js';
import type { Pagination } from '../../lib/pagination.js';


export interface CreateClientInput {
  name: string;
  active?: boolean;
}

export interface UpdateClientInput {
  name?: string;
  active?: boolean;
}

export function createClientsRepository(db: typeof Db) {
  return {
    async list(tenantId: string, pagination: Pagination) {
      const where = eq(clients.tenantId, tenantId);

      const [rows, countRows] = await Promise.all([
        db.select().from(clients).where(where).limit(pagination.limit).offset(pagination.offset),
        db.select({ value: count() }).from(clients).where(where),
      ]);

      return { rows, total: firstOrThrow(countRows).value };
    },

    async findById(tenantId: string, id: string) {
      const [row] = await db
        .select()
        .from(clients)
        .where(and(eq(clients.tenantId, tenantId), eq(clients.id, id)))
        .limit(1);
      return row ?? null;
    },

    async create(tenantId: string, input: CreateClientInput) {
      const rows = await db
        .insert(clients)
        .values({ tenantId, name: input.name, active: input.active ?? true })
        .returning();
      return firstOrThrow(rows);
    },

    async update(tenantId: string, id: string, input: UpdateClientInput) {
      if (Object.keys(input).length === 0) {
        const [row] = await db
          .select()
          .from(clients)
          .where(and(eq(clients.tenantId, tenantId), eq(clients.id, id)))
          .limit(1);
        return row ?? null;
      }
      const rows = await db
        .update(clients)
        .set(input)
        .where(and(eq(clients.tenantId, tenantId), eq(clients.id, id)))
        .returning();
      return rows[0] ?? null;
    },
  };
}

export type ClientsRepository = ReturnType<typeof createClientsRepository>;
