import { boolean, integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  stripeProductId: text('stripe_product_id'),
  stripePriceId: text('stripe_price_id'),
  billingType: varchar('billing_type', { length: 20 }).notNull().default('monthly'),
  priceCents: integer('price_cents').notNull(),
  currency: varchar('currency', { length: 10 }).notNull().default('brl'),
  maxGestores: integer('max_gestores'),
  maxCreators: integer('max_creators'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;
