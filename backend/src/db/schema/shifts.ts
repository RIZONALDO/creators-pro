import { date, index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { companies } from './companies.js';
import { creators } from './creators.js';
import { users } from './users.js';

// 'pending'/'confirmed' existiam antes mas nunca tiveram função real — mesma pessoa (gestor) cria e
// "confirma", sem ação de terceiro, notificação ou relatório que diferencie os dois. Simplificado
// pra 3 estados que descrevem um desfecho de verdade: agendado, aconteceu, ou foi cancelado.
export const shiftStatusEnum = pgEnum('shift_status', ['scheduled', 'completed', 'cancelled']);
export type ShiftStatus = (typeof shiftStatusEnum.enumValues)[number];

export const shifts = pgTable(
  'shifts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
    shiftDate: date('shift_date', { mode: 'string' }).notNull(),
    // restrict: creator com plantão registrado não pode ser apagado.
    creatorId: uuid('creator_id').references(() => creators.id, { onDelete: 'restrict' }),
    notes: text('notes'),
    status: shiftStatusEnum('status').notNull().default('scheduled'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantDateIdx: index('shifts_tenant_date_idx').on(t.tenantId, t.shiftDate),
  }),
);
