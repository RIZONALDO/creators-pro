import { pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const superadmins = pgTable('superadmins', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Superadmin = typeof superadmins.$inferSelect;
