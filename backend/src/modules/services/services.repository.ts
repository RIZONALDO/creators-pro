import { and, count, eq } from 'drizzle-orm';
import type { db as Db } from '../../db/client.js';
import { collaboratorServices, type ServiceStatus } from '../../db/schema/index.js';
import { firstOrThrow } from '../../lib/firstOrThrow.js';
import type { Pagination } from '../../lib/pagination.js';

export interface CreateServiceInput {
  tenantId: string;
  serviceName: string;
  serviceDate?: string | null;
  serviceType?: string | null;
  collaboratorId?: string | null;
  clientId?: string | null;
  status?: ServiceStatus;
  notes?: string | null;
  createdBy: string;
}

export interface UpdateServiceInput {
  serviceName?: string;
  serviceDate?: string | null;
  serviceType?: string | null;
  collaboratorId?: string | null;
  clientId?: string | null;
  notes?: string | null;
}

export interface ServiceListFilter {
  collaboratorId?: string;
}

export function createServicesRepository(db: typeof Db) {
  function whereFor(tenantId: string, filter?: ServiceListFilter) {
    const conditions = [eq(collaboratorServices.tenantId, tenantId)];
    if (filter?.collaboratorId) conditions.push(eq(collaboratorServices.collaboratorId, filter.collaboratorId));
    return and(...conditions);
  }

  async function findById(tenantId: string, id: string) {
    const [row] = await db
      .select()
      .from(collaboratorServices)
      .where(and(eq(collaboratorServices.tenantId, tenantId), eq(collaboratorServices.id, id)))
      .limit(1);
    return row ?? null;
  }

  return {
    findById,

    async list(tenantId: string, pagination: Pagination, filter?: ServiceListFilter) {
      const where = whereFor(tenantId, filter);

      const [rows, countRows] = await Promise.all([
        db.select().from(collaboratorServices).where(where).limit(pagination.limit).offset(pagination.offset),
        db.select({ value: count() }).from(collaboratorServices).where(where),
      ]);

      return { rows, total: firstOrThrow(countRows).value };
    },

    async create(input: CreateServiceInput) {
      const rows = await db
        .insert(collaboratorServices)
        .values({
          tenantId: input.tenantId,
          serviceName: input.serviceName,
          serviceDate: input.serviceDate ?? null,
          serviceType: input.serviceType ?? null,
          collaboratorId: input.collaboratorId ?? null,
          clientId: input.clientId ?? null,
          status: input.status ?? 'agendado',
          notes: input.notes ?? null,
          createdBy: input.createdBy,
        })
        .returning();
      return firstOrThrow(rows);
    },

    async update(tenantId: string, id: string, input: UpdateServiceInput) {
      if (Object.keys(input).length === 0) return findById(tenantId, id);
      const rows = await db
        .update(collaboratorServices)
        .set(input)
        .where(and(eq(collaboratorServices.tenantId, tenantId), eq(collaboratorServices.id, id)))
        .returning();
      return rows[0] ?? null;
    },

    async updateStatus(tenantId: string, id: string, status: ServiceStatus) {
      const rows = await db
        .update(collaboratorServices)
        .set({ status })
        .where(and(eq(collaboratorServices.tenantId, tenantId), eq(collaboratorServices.id, id)))
        .returning();
      return rows[0] ?? null;
    },
  };
}

export type ServicesRepository = ReturnType<typeof createServicesRepository>;
