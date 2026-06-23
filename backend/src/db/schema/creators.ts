import { boolean, index, integer, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { companies } from './companies';
import { users } from './users';
import { employmentTypeEnum } from './enums';

export const creators = pgTable(
  'creators',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    employmentType: employmentTypeEnum('employment_type'),
    active: boolean('active').notNull().default(true),
    // Ordem definida por drag na paleta da Escala — base do round-robin da escala automática
    // (listActiveIds ordena por isto). Default 0 em todos: sem reordenar nada, o tiebreak por
    // createdAt mantém o comportamento de hoje (ordem de criação).
    scaleOrder: integer('scale_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('creators_tenant_idx').on(t.tenantId),
  }),
);
