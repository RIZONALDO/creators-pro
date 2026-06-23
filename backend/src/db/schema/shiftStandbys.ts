import { index, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { companies } from './companies';
import { shifts } from './shifts';
import { creators } from './creators';

// Sobreaviso: 0+ creators de backup por plantão, além do plantonista titular (shifts.creator_id).
// Recebem a mesma notificação 'novo_plantao' do titular — ver shifts.service.ts.
export const shiftStandbys = pgTable(
  'shift_standbys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
    // cascade: a lista de sobreaviso só existe no contexto do plantão — apagando o plantão, some com ele.
    shiftId: uuid('shift_id').notNull().references(() => shifts.id, { onDelete: 'cascade' }),
    // restrict: mesmo padrão de shifts.creatorId/absences.creatorId — creator com sobreaviso registrado não pode ser apagado.
    creatorId: uuid('creator_id').notNull().references(() => creators.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqueShiftCreator: unique('shift_standbys_shift_creator').on(t.shiftId, t.creatorId),
    tenantShiftIdx: index('shift_standbys_tenant_shift_idx').on(t.tenantId, t.shiftId),
    tenantCreatorIdx: index('shift_standbys_tenant_creator_idx').on(t.tenantId, t.creatorId),
  }),
);
