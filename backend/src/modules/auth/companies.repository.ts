import { eq } from 'drizzle-orm';
import type { db as Db } from '../../db/client.js';
import { firstOrThrow } from '../../lib/firstOrThrow.js';
import { companies } from '../../db/schema/index.js';

export interface CreateCompanyInput {
  name: string;
  slug: string;
}

export function createCompaniesRepository(db: typeof Db) {
  return {
    async findBySlug(slug: string) {
      const [row] = await db.select().from(companies).where(eq(companies.slug, slug)).limit(1);
      return row ?? null;
    },

    async findById(id: string) {
      const [row] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
      return row ?? null;
    },

    async create(input: CreateCompanyInput) {
      const rows = await db.insert(companies).values({ name: input.name, slug: input.slug }).returning();
      return firstOrThrow(rows);
    },
  };
}

export type CompaniesRepository = ReturnType<typeof createCompaniesRepository>;
