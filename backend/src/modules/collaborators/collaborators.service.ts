import type { db as Db } from '../../db/client.js';
import { notFound } from '../../lib/errors.js';
import type { Pagination } from '../../lib/pagination.js';
import { createCollaboratorsRepository, type CollaboratorView } from './collaborators.repository.js';
import type { newCollaboratorSchema, updateCollaboratorSchema } from './collaborators.schemas.js';
import type { z } from 'zod';

export function createCollaboratorsService(db: typeof Db) {
  const repo = createCollaboratorsRepository(db);

  return {
    async list(tenantId: string, pagination: Pagination) {
      return repo.list(tenantId, pagination);
    },

    async create(tenantId: string, input: z.infer<typeof newCollaboratorSchema>): Promise<CollaboratorView> {
      return repo.createRow({
        tenantId,
        name: input.name?.trim() || input.email || 'Sem nome',
        email: input.email ?? null,
        phone: input.phone ?? null,
        profession: input.profession,
        employmentType: input.employment_type,
        active: input.active ?? true,
      });
    },

    async update(tenantId: string, id: string, input: z.infer<typeof updateCollaboratorSchema>): Promise<CollaboratorView> {
      const row = await repo.findRowById(tenantId, id);
      if (!row) throw notFound('COLLABORATOR_NOT_FOUND', 'Colaborador não encontrado.');

      const updated = await repo.updateRow(tenantId, id, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.profession !== undefined ? { profession: input.profession } : {}),
        ...(input.employment_type !== undefined ? { employmentType: input.employment_type } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      });

      if (!updated) throw notFound('COLLABORATOR_NOT_FOUND', 'Colaborador não encontrado.');
      return updated;
    },

    async remove(tenantId: string, id: string) {
      const row = await repo.findRowById(tenantId, id);
      if (!row) throw notFound('COLLABORATOR_NOT_FOUND', 'Colaborador não encontrado.');
      await repo.deleteRow(tenantId, id);
    },
  };
}

export type CollaboratorsService = ReturnType<typeof createCollaboratorsService>;
