import { date, index, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { companies } from './companies';
import { collaborators } from './collaborators';
import { clients } from './clients';
import { users } from './users';

export const serviceStatusEnum = pgEnum('service_status', ['agendado', 'em_andamento', 'concluido', 'cancelado']);
export type ServiceStatus = (typeof serviceStatusEnum.enumValues)[number];

export const collaboratorServices = pgTable(
  'collaborator_services',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
    serviceName: varchar('service_name', { length: 255 }).notNull(),
    serviceDate: date('service_date', { mode: 'string' }),
    serviceType: varchar('service_type', { length: 100 }),
    collaboratorId: uuid('collaborator_id').references(() => collaborators.id, { onDelete: 'set null' }),
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'restrict' }),
    status: serviceStatusEnum('status').notNull().default('agendado'),
    notes: text('notes'),
    createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantStatusIdx: index('services_tenant_status_idx').on(t.tenantId, t.status),
    tenantCollaboratorIdx: index('services_tenant_collaborator_idx').on(t.tenantId, t.collaboratorId),
  }),
);
