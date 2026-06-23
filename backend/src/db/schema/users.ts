import { index, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { companies } from './companies';

export const userRoleEnum = pgEnum('user_role', ['admin', 'gestor', 'operacional']);
export const userStatusEnum = pgEnum('user_status', ['active', 'inactive']);

export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type UserStatus = (typeof userStatusEnum.enumValues)[number];

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    phone: varchar('phone', { length: 50 }),
    passwordHash: text('password_hash').notNull(),
    avatarUrl: text('avatar_url'),
    // Apelido de exibição (ex.: "Coordenador", "Admin") — default vem do role, mas o admin pode
    // sobrescrever por conta (ex.: "Diretor" em vez de "Admin"). Só usado por admin/gestor: conta
    // operacional usa Creator/Colaborador, escolha estrutural (define a tabela), não texto livre.
    alias: varchar('alias', { length: 100 }),
    role: userRoleEnum('role').notNull(),
    status: userStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('users_tenant_idx').on(t.tenantId),
  }),
);
