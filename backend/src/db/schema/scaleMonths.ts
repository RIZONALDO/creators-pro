import { integer, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { companies } from './companies';
import { users } from './users';

export const scaleMonths = pgTable(
  'scale_months',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
    month: integer('month').notNull(),
    year: integer('year').notNull(),
    createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqueMonth: unique('scale_months_tenant_month_year').on(t.tenantId, t.month, t.year),
  }),
);
