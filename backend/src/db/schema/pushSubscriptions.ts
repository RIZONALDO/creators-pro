import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { companies } from './companies.js';
import { users } from './users.js';

/** Uma linha por dispositivo/navegador inscrito (PushSubscription da Push API) — um usuário pode ter várias. */
export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('push_subscriptions_user_idx').on(t.userId),
  }),
);
