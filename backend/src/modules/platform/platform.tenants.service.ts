import { count, eq, sql } from 'drizzle-orm';
import type { db as Db } from '../../db/client.js';
import { companies, creators, creatorTasks, plans, users, type CompanyStatus } from '../../db/schema/index.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { slugify, uniqueSlug } from '../../lib/slug.js';
import bcrypt from 'bcryptjs';

export function createPlatformTenantsService(db: typeof Db) {
  return {
    async list() {
      const rows = await db
        .select({
          id: companies.id,
          name: companies.name,
          slug: companies.slug,
          status: companies.status,
          createdAt: companies.createdAt,
          userCount: count(users.id),
        })
        .from(companies)
        .leftJoin(users, eq(users.tenantId, companies.id))
        .groupBy(companies.id)
        .orderBy(companies.createdAt);
      return rows;
    },

    async getWithMetrics(id: string) {
      const [company] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
      if (!company) throw notFound('TENANT_NOT_FOUND', 'Tenant não encontrado.');

      const [[userCountRow], [creatorCountRow], [taskCountRow]] = await Promise.all([
        db.select({ n: count(users.id) }).from(users).where(eq(users.tenantId, id)),
        db.select({ n: count(creators.id) }).from(creators).where(eq(creators.tenantId, id)),
        db.select({ n: count(creatorTasks.id) }).from(creatorTasks).where(eq(creatorTasks.tenantId, id)),
      ]);

      return {
        ...company,
        metrics: {
          users: userCountRow?.n ?? 0,
          creators: creatorCountRow?.n ?? 0,
          tasks: taskCountRow?.n ?? 0,
        },
      };
    },

    async updateStatus(id: string, status: CompanyStatus) {
      const [existing] = await db.select({ id: companies.id }).from(companies).where(eq(companies.id, id)).limit(1);
      if (!existing) throw notFound('TENANT_NOT_FOUND', 'Tenant não encontrado.');

      const [updated] = await db.update(companies).set({ status, updatedAt: new Date() }).where(eq(companies.id, id)).returning();
      return updated!;
    },

    async updatePlan(id: string, input: { planId: string | null; planOverride?: Record<string, unknown> | null; lifetime?: boolean }) {
      const [existing] = await db.select({ id: companies.id }).from(companies).where(eq(companies.id, id)).limit(1);
      if (!existing) throw notFound('TENANT_NOT_FOUND', 'Tenant não encontrado.');

      if (input.planId) {
        const [plan] = await db.select({ id: plans.id }).from(plans).where(eq(plans.id, input.planId)).limit(1);
        if (!plan) throw badRequest('PLAN_NOT_FOUND', 'Plano não encontrado.');
      }

      const [updated] = await db
        .update(companies)
        .set({
          planId: input.planId,
          planOverride: input.planOverride ?? null,
          lifetime: input.lifetime ?? false,
          updatedAt: new Date(),
        })
        .where(eq(companies.id, id))
        .returning();

      return updated!;
    },

    async create(input: { name: string; adminName: string; adminEmail: string; adminPassword: string }) {
      const baseSlug = slugify(input.name);
      const slug = await uniqueSlug(baseSlug, (s) =>
        db.select({ id: companies.id }).from(companies).where(eq(companies.slug, s)).limit(1).then((r) => r.length > 0),
      );

      const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.adminEmail)).limit(1);
      if (existingUser) throw conflict('EMAIL_TAKEN', 'Este e-mail já está cadastrado na plataforma.');

      return db.transaction(async (tx) => {
        const [company] = await tx.insert(companies).values({ name: input.name, slug, status: 'active' }).returning();
        const passwordHash = await bcrypt.hash(input.adminPassword, 12);
        await tx.insert(users).values({
          tenantId: company!.id,
          name: input.adminName,
          email: input.adminEmail,
          passwordHash,
          role: 'admin',
          status: 'active',
        });
        return company!;
      });
    },
  };
}

export type PlatformTenantsService = ReturnType<typeof createPlatformTenantsService>;
