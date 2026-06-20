import { date, index, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { companies } from './companies';
import { creators } from './creators';
import { clients } from './clients';
import { users } from './users';

export const taskFormatEnum = pgEnum('task_format', [
  'Story',
  'Reels',
  'Story/Reels',
  'Select',
  'Edição',
  'Sonora',
  'Banco',
  'Aftermovie',
  'Captação',
  'Roteiro',
]);

export const taskStatusEnum = pgEnum('task_status', [
  'na_fila',
  'em_edicao',
  'no_servidor',
  'em_aprovacao',
  'em_alteracao',
  'falta_captacao',
  'aprovado',
  'reprovado',
  'cancelado',
]);

export type TaskFormat = (typeof taskFormatEnum.enumValues)[number];
export type TaskStatus = (typeof taskStatusEnum.enumValues)[number];

export const creatorTasks = pgTable(
  'creator_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
    title: varchar('title', { length: 255 }).notNull(),
    formatType: taskFormatEnum('format_type'),
    taskDate: date('task_date', { mode: 'string' }), // string ISO YYYY-MM-DD, igual ao tipo do frontend
    creatorId: uuid('creator_id').references(() => creators.id, { onDelete: 'set null' }),
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'restrict' }),
    status: taskStatusEnum('status').notNull().default('na_fila'),
    description: text('description'),
    createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantStatusIdx: index('tasks_tenant_status_idx').on(t.tenantId, t.status),
    tenantDateIdx: index('tasks_tenant_date_idx').on(t.tenantId, t.taskDate),
    tenantCreatorIdx: index('tasks_tenant_creator_idx').on(t.tenantId, t.creatorId),
  }),
);
