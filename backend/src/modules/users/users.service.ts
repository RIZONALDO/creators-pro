import bcrypt from 'bcryptjs';
import type { db as Db } from '../../db/client.js';
import { conflict, notFound } from '../../lib/errors.js';
import type { Pagination } from '../../lib/pagination.js';
import { sanitizeUser } from '../../lib/sanitizeUser.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { checkGestorLimit } from '../platform/plan.limits.js';
import type { newUserSchema, updateUserSchema } from './users.schemas.js';
import type { z } from 'zod';

/** Único papel editável/excluível por aqui — admin nunca aparece como alvo de PUT/DELETE (só de
 * leitura na listagem), e operacional nem aparece (gerenciado em Cadastros pelo gestor). */
async function requireGestor(usersRepo: ReturnType<typeof createUsersRepository>, tenantId: string, id: string) {
  const user = await usersRepo.findByIdInTenant(tenantId, id);
  if (!user) throw notFound('USER_NOT_FOUND', 'Usuário não encontrado.');
  if (user.role !== 'gestor') {
    throw conflict('CANNOT_MODIFY_ADMIN', 'Essa conta não pode ser editada ou excluída por aqui.');
  }
  return user;
}

export function createUsersAdminService(db: typeof Db) {
  const usersRepo = createUsersRepository(db);

  return {
    /** admin (leitura) + gestor — nunca operacional (Creator/Colaborador são gerenciados em
     * Cadastros, pelo próprio gestor, não aqui). creator_id/collaborator_id/profession sempre null
     * aqui (mantidos só pra bater a mesma forma de User usada em outros endpoints). */
    async list(tenantId: string, pagination: Pagination) {
      const { rows, total } = await usersRepo.listByTenant(tenantId, pagination, ['admin', 'gestor']);
      return {
        rows: rows.map((u) => ({ ...sanitizeUser(u), creatorId: null, collaboratorId: null, profession: null })),
        total,
      };
    },

    /** Sempre role='gestor' — admin só nasce via signup/trial/provisionamento interno (ver
     * users.schemas.ts), nunca por aqui. */
    async create(tenantId: string, input: z.infer<typeof newUserSchema>) {
      await checkGestorLimit(db, tenantId);

      const existing = await usersRepo.findByEmail(input.email);
      if (existing) throw conflict('EMAIL_TAKEN', 'Já existe um usuário com este e-mail.');

      const passwordHash = await bcrypt.hash(input.password, 10);
      const user = await usersRepo.create({
        tenantId,
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        passwordHash,
        role: 'gestor',
        status: input.status,
        alias: input.alias,
      });

      return sanitizeUser(user);
    },

    async update(tenantId: string, id: string, input: z.infer<typeof updateUserSchema>) {
      await requireGestor(usersRepo, tenantId, id);

      if (input.email !== undefined) {
        const existing = await usersRepo.findByEmail(input.email);
        if (existing && existing.id !== id) throw conflict('EMAIL_TAKEN', 'Já existe um usuário com este e-mail.');
      }

      if (input.password !== undefined) {
        const passwordHash = await bcrypt.hash(input.password, 10);
        await usersRepo.updatePassword(id, passwordHash);
      }

      const updated = await usersRepo.updateAdmin(tenantId, id, input);
      if (!updated) throw notFound('USER_NOT_FOUND', 'Usuário não encontrado.');
      return sanitizeUser(updated);
    },

    async delete(tenantId: string, id: string) {
      await requireGestor(usersRepo, tenantId, id);
      await usersRepo.deleteById(tenantId, id);
    },
  };
}

export type UsersAdminService = ReturnType<typeof createUsersAdminService>;
