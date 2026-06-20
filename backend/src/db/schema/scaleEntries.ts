import { boolean, date, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { companies } from './companies';
import { scaleMonths } from './scaleMonths';
import { creators } from './creators';

export const scaleEntries = pgTable(
  'scale_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
    scaleMonthId: uuid('scale_month_id')
      .notNull()
      .references(() => scaleMonths.id, { onDelete: 'cascade' }),
    creatorId: uuid('creator_id').references(() => creators.id, { onDelete: 'set null' }),
    workDate: date('work_date', { mode: 'string' }).notNull(),
    isHoliday: boolean('is_holiday').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqueWorkDate: unique('scale_entries_tenant_work_date').on(t.tenantId, t.workDate),
  }),
);
