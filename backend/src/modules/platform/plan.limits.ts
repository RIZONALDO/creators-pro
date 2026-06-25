import { count, eq } from 'drizzle-orm';
import type { db as Db } from '../../db/client.js';
import { companies, creators, plans, users } from '../../db/schema/index.js';
import { badRequest } from '../../lib/errors.js';

/** Retorna os limites efetivos de um tenant: plan_override sobrescreve o plano base. */
async function getEffectiveLimits(db: typeof Db, tenantId: string) {
  const [company] = await db
    .select({ planId: companies.planId, planOverride: companies.planOverride })
    .from(companies)
    .where(eq(companies.id, tenantId))
    .limit(1);

  if (!company?.planId) return { maxGestores: null, maxCreators: null };

  const [plan] = await db.select({ maxGestores: plans.maxGestores, maxCreators: plans.maxCreators })
    .from(plans)
    .where(eq(plans.id, company.planId))
    .limit(1);

  if (!plan) return { maxGestores: null, maxCreators: null };

  const override = company.planOverride as { maxGestores?: number; maxCreators?: number } | null;
  return {
    maxGestores: override?.maxGestores ?? plan.maxGestores,
    maxCreators: override?.maxCreators ?? plan.maxCreators,
  };
}

export async function checkGestorLimit(db: typeof Db, tenantId: string) {
  const limits = await getEffectiveLimits(db, tenantId);
  if (limits.maxGestores === null) return; // ilimitado

  const result = await db
    .select({ n: count(users.id) })
    .from(users)
    .where(eq(users.tenantId, tenantId));
  const n = result[0]?.n ?? 0;

  if (n >= limits.maxGestores) {
    throw badRequest('PLAN_LIMIT_EXCEEDED', `Seu plano permite até ${limits.maxGestores} gestor(es). Faça upgrade para adicionar mais.`);
  }
}

export async function checkCreatorLimit(db: typeof Db, tenantId: string) {
  const limits = await getEffectiveLimits(db, tenantId);
  if (limits.maxCreators === null) return; // ilimitado

  const result = await db
    .select({ n: count(creators.id) })
    .from(creators)
    .where(eq(creators.tenantId, tenantId));
  const n = result[0]?.n ?? 0;

  if (n >= limits.maxCreators) {
    throw badRequest('PLAN_LIMIT_EXCEEDED', `Seu plano permite até ${limits.maxCreators} creator(s). Faça upgrade para adicionar mais.`);
  }
}
