import { and, count, eq } from 'drizzle-orm';
import type { db as Db } from '../../db/client.js';
import { creators, users, type EmploymentType } from '../../db/schema/index.js';
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

  return {
    findRowById,
    findRowByUserId,

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
  };
}

export type CreatorsRepository = ReturnType<typeof createCreatorsRepository>;
