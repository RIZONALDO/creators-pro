import { boolean, index, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { companies } from './companies.js';
import { users } from './users.js';

// Ver specs/06-regras-de-negocio.md#gatilhos-de-notificação.
export const notificationTypeEnum = pgEnum('notification_type', [
  'nova_tarefa',
  'mudanca_status',
  'ausencia_aprovada',
  'ausencia_rejeitada',
  'novo_plantao',
  'alteracao_escala',
  'registro_tarefa',
]);
export type NotificationType = (typeof notificationTypeEnum.enumValues)[number];

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }),
    description: text('description'),
    type: notificationTypeEnum('type').notNull(),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userUnreadIdx: index('notifications_user_unread_idx').on(t.userId, t.isRead),
  }),
);
