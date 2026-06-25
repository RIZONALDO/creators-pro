import { integer, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { companies } from './companies.js';
import { users } from './users.js';

export const scaleMonths = pgTable(
  'scale_months',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
    month: integer('month').notNull(),
    year: integer('year').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqueMonth: unique('scale_months_tenant_month_year').on(t.tenantId, t.month, t.year),
  }),
);
