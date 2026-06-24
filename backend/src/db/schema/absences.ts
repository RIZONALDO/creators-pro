import { date, index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { companies } from './companies.js';
import { creators } from './creators.js';
import { users } from './users.js';

export const absenceStatusEnum = pgEnum('absence_status', ['pending', 'approved', 'rejected']);
export type AbsenceStatus = (typeof absenceStatusEnum.enumValues)[number];

export const absences = pgTable(
  'absences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
    // restrict (não cascade): apagar um creator com ausências registradas precisa falhar, não apagar o histórico em cascata.
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => creators.id, { onDelete: 'restrict' }),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    endDate: date('end_date', { mode: 'string' }).notNull(),
    reason: text('reason'),
    status: absenceStatusEnum('status').notNull().default('pending'),
    approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantStatusIdx: index('absences_tenant_status_idx').on(t.tenantId, t.status),
    tenantCreatorIdx: index('absences_tenant_creator_idx').on(t.tenantId, t.creatorId),
  }),
);
