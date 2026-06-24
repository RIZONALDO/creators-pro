import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { companies } from './companies.js';
import { users } from './users.js';

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
    // restrict: sender/receiver precisam pertencer ao mesmo tenant da mensagem — validado no service layer.
    senderId: uuid('sender_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
    receiverId: uuid('receiver_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
    message: text('message').notNull(),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    conversationIdx: index('messages_tenant_pair_idx').on(t.tenantId, t.senderId, t.receiverId),
  }),
);
