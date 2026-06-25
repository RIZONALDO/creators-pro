import { boolean, jsonb, pgEnum, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

// 'trial': self-service sem cartão (4h grátis, ver auth.service.ts#startTrial) — login só funciona
// enquanto trial_ends_at não passou; depois disso é bloqueado igual 'suspended', mas com um motivo
// (TRIAL_EXPIRED) e um caminho de upgrade próprio (billing.service.ts#upgradeTrial), já que não
// existe assinatura Stripe nenhuma ainda nesse estado pra mandar e-mail de cobrança.
export const companyStatusEnum = pgEnum('company_status', ['active', 'suspended', 'cancelled', 'trial']);
export type CompanyStatus = (typeof companyStatusEnum.enumValues)[number];

export const companies = pgTable('companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  status: companyStatusEnum('status').notNull().default('active'),
  // Fase 9.1 (self-service signup + billing) — null pra tenants provisionados manualmente
  // (/internal/companies), preenchido só pros que vieram do fluxo de assinatura via Stripe.
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }).unique(),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  // Só preenchido quando status = 'trial' — momento em que o login passa a ser bloqueado.
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
  // Fase 11b: plano e flags de billing da plataforma
  planId: uuid('plan_id'),
  // Sobrescreve limites do plano pra este tenant sem criar plano novo (ex.: cliente VIP).
  planOverride: jsonb('plan_override').$type<{ maxGestores?: number; maxCreators?: number; reason?: string }>(),
  // Tenant vitalício: nunca suspenso por billing mesmo sem assinatura ativa.
  lifetime: boolean('lifetime').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
