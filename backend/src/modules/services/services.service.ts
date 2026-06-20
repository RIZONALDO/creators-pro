import type { db as Db } from '../../db/client.js';
import type { AuthContext } from '../../middleware/authenticate.js';
import { badRequest, notFound } from '../../lib/errors.js';
import type { Pagination } from '../../lib/pagination.js';
import { createClientsRepository } from '../clients/clients.repository.js';
import { createCollaboratorsRepository } from '../collaborators/collaborators.repository.js';
import { createStatusHistoryRepository } from '../statusHistory/statusHistory.repository.js';
import { createServicesRepository } from './services.repository.js';
import type { newServiceSchema, updateServiceSchema } from './services.schemas.js';
import type { ServiceStatus } from '../../db/schema/index.js';
import type { z } from 'zod';

export function createServicesService(db: typeof Db) {
  const servicesRepo = createServicesRepository(db);
  const collaboratorsRepo = createCollaboratorsRepository(db);
  const clientsRepo = createClientsRepository(db);

  async function assertCollaboratorBelongsToTenant(tenantId: string, collaboratorId: string | null | undefined) {
    if (!collaboratorId) return;
    const row = await collaboratorsRepo.findRowById(tenantId, collaboratorId);
    if (!row) throw badRequest('INVALID_COLLABORATOR', 'Colaborador inválido para este tenant.');
  }

  async function assertClientBelongsToTenant(tenantId: string, clientId: string | null | undefined) {
    if (!clientId) return;
    const row = await clientsRepo.findById(tenantId, clientId);
    if (!row) throw badRequest('INVALID_CLIENT', 'Cliente inválido para este tenant.');
  }

  return {
    /** operacional só vê os próprios serviços (resolvido pelo collaborator vinculado ao seu user_id). */
    async list(auth: AuthContext, pagination: Pagination) {
      if (auth.role === 'operacional') {
        const collaborator = await collaboratorsRepo.findRowByUserId(auth.tenantId, auth.userId);
        if (!collaborator) return { rows: [], total: 0 };
        return servicesRepo.list(auth.tenantId, pagination, { collaboratorId: collaborator.id });
      }
      return servicesRepo.list(auth.tenantId, pagination);
    },

    async create(tenantId: string, createdBy: string, input: z.infer<typeof newServiceSchema>) {
      await assertCollaboratorBelongsToTenant(tenantId, input.collaborator_id);
      await assertClientBelongsToTenant(tenantId, input.client_id);

      return servicesRepo.create({
        tenantId,
        serviceName: input.service_name,
        serviceDate: input.service_date ?? null,
        serviceType: input.service_type ?? null,
        collaboratorId: input.collaborator_id ?? null,
        clientId: input.client_id ?? null,
        status: input.status,
        notes: input.notes ?? null,
        createdBy,
      });
    },

    async update(tenantId: string, id: string, input: z.infer<typeof updateServiceSchema>) {
      await assertCollaboratorBelongsToTenant(tenantId, input.collaborator_id);
      await assertClientBelongsToTenant(tenantId, input.client_id);

      const updated = await servicesRepo.update(tenantId, id, {
        ...(input.service_name !== undefined ? { serviceName: input.service_name } : {}),
        ...(input.service_date !== undefined ? { serviceDate: input.service_date } : {}),
        ...(input.service_type !== undefined ? { serviceType: input.service_type } : {}),
        ...(input.collaborator_id !== undefined ? { collaboratorId: input.collaborator_id } : {}),
        ...(input.client_id !== undefined ? { clientId: input.client_id } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      });
      if (!updated) throw notFound('SERVICE_NOT_FOUND', 'Serviço não encontrado.');
      return updated;
    },

    async setStatus(tenantId: string, id: string, status: ServiceStatus, changedBy: string) {
      return db.transaction(async (tx) => {
        const txServicesRepo = createServicesRepository(tx as typeof Db);
        const txHistoryRepo = createStatusHistoryRepository(tx as typeof Db);

        const existing = await txServicesRepo.findById(tenantId, id);
        if (!existing) throw notFound('SERVICE_NOT_FOUND', 'Serviço não encontrado.');

        const updated = await txServicesRepo.updateStatus(tenantId, id, status);
        await txHistoryRepo.record({
          tenantId,
          entityType: 'service',
          entityId: id,
          oldStatus: existing.status,
          newStatus: status,
          changedBy,
        });

        return updated;
      });
    },
  };
}

export type ServicesService = ReturnType<typeof createServicesService>;
