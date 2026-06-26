import { boolean, index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { companies } from './companies.js';
import { employmentTypeEnum } from './enums.js';

export const collaborators = pgTable(
  'collaborators',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 50 }),
    profession: varchar('profession', { length: 100 }),
    employmentType: employmentTypeEnum('employment_type'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('collaborators_tenant_idx').on(t.tenantId),
  }),
);
