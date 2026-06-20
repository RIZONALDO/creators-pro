import bcrypt from 'bcryptjs';
import type { db as Db } from '../../db/client.js';
import { conflict, notFound } from '../../lib/errors.js';
import type { Pagination } from '../../lib/pagination.js';
import { generateOpaqueToken } from '../../lib/tokens.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { createCollaboratorsRepository, type CollaboratorView } from './collaborators.repository.js';
import type { newCollaboratorSchema, updateCollaboratorSchema } from './collaborators.schemas.js';
import type { z } from 'zod';

export function createCollaboratorsService(db: typeof Db) {
  const collaboratorsRepo = createCollaboratorsRepository(db);
  const usersRepo = createUsersRepository(db);

  return {
    async list(tenantId: string, pagination: Pagination) {
      return collaboratorsRepo.list(tenantId, pagination);
    },

    async create(tenantId: string, input: z.infer<typeof newCollaboratorSchema>): Promise<CollaboratorView> {
      const existingUser = await usersRepo.findByEmail(input.email);
      if (existingUser) throw conflict('EMAIL_TAKEN', 'Já existe um usuário com este e-mail.');

      const temporaryPassword = generateOpaqueToken();
      const passwordHash = await bcrypt.hash(temporaryPassword, 10);

      return db.transaction(async (tx) => {
        const txUsersRepo = createUsersRepository(tx as typeof Db);
        const txCollaboratorsRepo = createCollaboratorsRepository(tx as typeof Db);

        const user = await txUsersRepo.create({
          tenantId,
          name: input.name,
          email: input.email,
          phone: input.phone ?? null,
          passwordHash,
          role: 'operacional',
        });

        const row = await txCollaboratorsRepo.createRow({
          tenantId,
          userId: user.id,
          profession: input.profession,
          employmentType: input.employment_type,
          active: input.active ?? true,
        });

        return {
          id: row.id,
          tenantId: row.tenantId,
          userId: row.userId,
          profession: row.profession,
          employmentType: row.employmentType,
          active: row.active,
          createdAt: row.createdAt,
          name: user.name,
          email: user.email,
          phone: user.phone,
        };
      });
    },

    async update(tenantId: string, id: string, input: z.infer<typeof updateCollaboratorSchema>): Promise<CollaboratorView> {
      return db.transaction(async (tx) => {
        const txUsersRepo = createUsersRepository(tx as typeof Db);
        const txCollaboratorsRepo = createCollaboratorsRepository(tx as typeof Db);

        const row = await txCollaboratorsRepo.findRowById(tenantId, id);
        if (!row) throw notFound('COLLABORATOR_NOT_FOUND', 'Colaborador não encontrado.');

        if (input.profession !== undefined || input.employment_type !== undefined || input.active !== undefined) {
          await txCollaboratorsRepo.updateRow(tenantId, id, {
            ...(input.profession !== undefined ? { profession: input.profession } : {}),
            ...(input.employment_type !== undefined ? { employmentType: input.employment_type } : {}),
            ...(input.active !== undefined ? { active: input.active } : {}),
          });
        }

        if (input.name !== undefined || input.email !== undefined || input.phone !== undefined) {
          if (input.email !== undefined) {
            const existing = await txUsersRepo.findByEmail(input.email);
            if (existing && existing.id !== row.userId) {
              throw conflict('EMAIL_TAKEN', 'Já existe um usuário com este e-mail.');
            }
          }
          await txUsersRepo.updateProfile(row.userId, { name: input.name, email: input.email, phone: input.phone });
        }

        const view = await txCollaboratorsRepo.findById(tenantId, id);
        if (!view) throw notFound('COLLABORATOR_NOT_FOUND', 'Colaborador não encontrado.');
        return view;
      });
    },
  };
}

export type CollaboratorsService = ReturnType<typeof createCollaboratorsService>;
