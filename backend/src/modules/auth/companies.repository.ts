import { eq } from 'drizzle-orm';
import type { db as Db } from '../../db/client.js';
import { firstOrThrow } from '../../lib/firstOrThrow.js';
import { companies, type CompanyStatus } from '../../db/schema/index.js';

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

    async findByStripeCustomerId(stripeCustomerId: string) {
      const [row] = await db.select().from(companies).where(eq(companies.stripeCustomerId, stripeCustomerId)).limit(1);
      return row ?? null;
    },

    async create(input: CreateCompanyInput) {
      const rows = await db.insert(companies).values({ name: input.name, slug: input.slug }).returning();
      return firstOrThrow(rows);
    },

    /** Fase 9.1: liga a empresa criada via signup à assinatura Stripe correspondente. */
    async setStripeIds(id: string, input: { stripeCustomerId: string; stripeSubscriptionId: string | null }) {
      const rows = await db.update(companies).set(input).where(eq(companies.id, id)).returning();
      return rows[0] ?? null;
    },

    async updateStatus(id: string, status: CompanyStatus) {
      const rows = await db.update(companies).set({ status }).where(eq(companies.id, id)).returning();
      return rows[0] ?? null;
    },
  };
}

export type CompaniesRepository = ReturnType<typeof createCompaniesRepository>;
