import { index, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { companies } from './companies.js';

export const userRoleEnum = pgEnum('user_role', ['admin', 'gestor', 'operacional']);
// 'pending': conta criada só com e-mail (sem senha) — aguarda o primeiro login com Google pra
// capturar nome/foto reais e virar 'active'. Ver auth.service.ts#loginWithGoogle.
export const userStatusEnum = pgEnum('user_status', ['active', 'inactive', 'pending']);

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
    // null enquanto a conta está 'pending' (convite só com e-mail, sem senha — login só via Google
    // até alguém definir uma senha de fato). Nunca comparar bcrypt contra null (ver auth.service.ts).
    passwordHash: text('password_hash'),
    avatarUrl: text('avatar_url'),
    // sub do Google (claim "sub" do ID token) — null até o primeiro login com Google.
    googleId: varchar('google_id', { length: 255 }).unique(),
    // hash (sha256) do token de convite — só existe enquanto a conta está 'pending'. Sem ele,
    // bastava o e-mail bater no Google pra reivindicar uma conta que ninguém provou ser sua;
    // null de novo depois do primeiro claim (token de uso único). Ver auth.service.ts#claimInviteWithGoogle.
    inviteTokenHash: varchar('invite_token_hash', { length: 64 }).unique(),
    // hash (sha256) do token de "esqueci a senha" — null fora de um reset em andamento. Expira
    // (passwordResetExpiresAt) e é de uso único (limpo no reset bem-sucedido), mesmo padrão do
    // invite_token_hash acima. Ver auth.service.ts#requestPasswordReset/resetPassword.
    passwordResetTokenHash: varchar('password_reset_token_hash', { length: 64 }).unique(),
    passwordResetExpiresAt: timestamp('password_reset_expires_at', { withTimezone: true }),
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
