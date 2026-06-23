import bcrypt from 'bcryptjs';
import type { db as Db } from '../../db/client.js';
import { conflict, notFound } from '../../lib/errors.js';
import type { Pagination } from '../../lib/pagination.js';
import { sanitizeUser } from '../../lib/sanitizeUser.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { createCreatorsRepository } from '../creators/creators.repository.js';
import { createCollaboratorsRepository } from '../collaborators/collaborators.repository.js';
import type { newUserSchema, updateUserSchema } from './users.schemas.js';
import type { z } from 'zod';

export function createUsersAdminService(db: typeof Db) {
  const usersRepo = createUsersRepository(db);
  const creatorsRepo = createCreatorsRepository(db);
  const collaboratorsRepo = createCollaboratorsRepository(db);

  return {
    /** role='operacional' sozinho não diz se é Creator ou Colaborador (apelidos distintos no
     * produto) — junta com os dois mapeamentos leves pra a tela de admin saber qual editar. */
    async list(tenantId: string, pagination: Pagination) {
      const [{ rows, total }, creatorRows, collaboratorRows] = await Promise.all([
        usersRepo.listByTenant(tenantId, pagination),
        creatorsRepo.listIdsByTenant(tenantId),
        collaboratorsRepo.listIdsByTenant(tenantId),
      ]);
      const creatorIdByUserId = new Map(creatorRows.map((r) => [r.userId, r.id]));
      const collaboratorIdByUserId = new Map(collaboratorRows.map((r) => [r.userId, r.id]));
      const professionByUserId = new Map(collaboratorRows.map((r) => [r.userId, r.profession]));

      return {
        rows: rows.map((u) => ({
          ...sanitizeUser(u),
          creatorId: creatorIdByUserId.get(u.id) ?? null,
          collaboratorId: collaboratorIdByUserId.get(u.id) ?? null,
          profession: professionByUserId.get(u.id) ?? null,
        })),
        total,
      };
    },

    async create(tenantId: string, input: z.infer<typeof newUserSchema>) {
      const existing = await usersRepo.findByEmail(input.email);
      if (existing) throw conflict('EMAIL_TAKEN', 'Já existe um usuário com este e-mail.');

      const passwordHash = await bcrypt.hash(input.password, 10);
      const user = await usersRepo.create({
        tenantId,
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        passwordHash,
        role: input.role,
        status: input.status,
        alias: input.alias,
      });

      return sanitizeUser(user);
    },

    async update(tenantId: string, id: string, input: z.infer<typeof updateUserSchema>) {
      if (input.email !== undefined) {
        const existing = await usersRepo.findByEmail(input.email);
        if (existing && existing.id !== id) throw conflict('EMAIL_TAKEN', 'Já existe um usuário com este e-mail.');
      }

      const updated = await usersRepo.updateAdmin(tenantId, id, input);
      if (!updated) throw notFound('USER_NOT_FOUND', 'Usuário não encontrado.');
      return sanitizeUser(updated);
    },
  };
}

export type UsersAdminService = ReturnType<typeof createUsersAdminService>;
