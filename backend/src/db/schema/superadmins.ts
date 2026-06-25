import { pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const superadmins = pgTable('superadmins', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  // 2FA TOTP — null = não configurado ainda; obrigatório após setup inicial (Fase 11b)
  totpSecret: text('totp_secret'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Superadmin = typeof superadmins.$inferSelect;
