import { index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { companies } from './companies.js';

export const professions = pgTable(
  'professions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('professions_tenant_idx').on(t.tenantId),
  }),
);
