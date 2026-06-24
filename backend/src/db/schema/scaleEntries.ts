import { boolean, date, index, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { companies } from './companies.js';
import { scaleMonths } from './scaleMonths.js';
import { creators } from './creators.js';

export const scaleEntries = pgTable(
  'scale_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
    scaleMonthId: uuid('scale_month_id')
      .notNull()
      .references(() => scaleMonths.id, { onDelete: 'cascade' }),
    // restrict: creator com escala atribuída (mesmo passada) não pode ser apagado.
    creatorId: uuid('creator_id').references(() => creators.id, { onDelete: 'restrict' }),
    workDate: date('work_date', { mode: 'string' }).notNull(),
    isHoliday: boolean('is_holiday').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // Mais de 1 creator no mesmo dia agora é permitido — o que continua proibido é o MESMO
    // creator duas vezes no mesmo dia (era unique(tenant,work_date) antes, 1 só slot por dia).
    uniqueWorkDatePerCreator: unique('scale_entries_tenant_work_date_creator').on(t.tenantId, t.workDate, t.creatorId),
    // Fase 9 (hardening): listByMonth() e listByCreatorInRange() filtravam sem índice — seq scan
    // inofensivo hoje (poucas linhas), real problema assim que o histórico de escala crescer.
    tenantMonthIdx: index('scale_entries_tenant_month_idx').on(t.tenantId, t.scaleMonthId),
    tenantCreatorIdx: index('scale_entries_tenant_creator_idx').on(t.tenantId, t.creatorId),
  }),
);
