import { pgEnum, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const companyStatusEnum = pgEnum('company_status', ['active', 'suspended', 'cancelled']);
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
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
