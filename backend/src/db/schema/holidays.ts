import { date, pgTable, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { companies } from './companies.js';

export const holidays = pgTable(
  'holidays',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').references(() => companies.id, { onDelete: 'cascade' }), // NULL = feriado nacional/global
    holidayDate: date('holiday_date', { mode: 'string' }).notNull(),
    description: varchar('description', { length: 255 }),
  },
  (t) => ({
    uniqueDate: unique('holidays_tenant_date').on(t.tenantId, t.holidayDate),
  }),
);
