import { index, pgEnum, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { companies } from './companies';
import { users } from './users';

// Polimórfica: cobre task | absence | shift | service com uma única tabela (mesmo padrão de attachments).
export const historyEntityEnum = pgEnum('history_entity', ['task', 'absence', 'shift', 'service']);
export type HistoryEntity = (typeof historyEntityEnum.enumValues)[number];

export const statusHistory = pgTable(
  'status_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
    entityType: historyEntityEnum('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    oldStatus: varchar('old_status', { length: 50 }),
    newStatus: varchar('new_status', { length: 50 }).notNull(),
    changedBy: uuid('changed_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
    changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    entityIdx: index('status_history_entity_idx').on(t.tenantId, t.entityType, t.entityId),
  }),
);
