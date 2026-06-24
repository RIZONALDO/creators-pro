import bcrypt from 'bcryptjs';
import type { db as Db } from '../../db/client.js';
import { conflict, notFound } from '../../lib/errors.js';
import type { Pagination } from '../../lib/pagination.js';
import { generateOpaqueToken, hashToken } from '../../lib/tokens.js';
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

    async create(tenantId: string, input: z.infer<typeof newCollaboratorSchema>): Promise<CollaboratorView & { inviteToken?: string }> {
      const existingUser = await usersRepo.findByEmail(input.email);
      if (existingUser) throw conflict('EMAIL_TAKEN', 'Já existe um usuário com este e-mail.');

      // Sem senha: conta nasce 'pending' (convite só com e-mail) — login só via Google, que captura
      // o nome real e ativa a conta no primeiro acesso. Token de convite: única forma de reivindicar
      // (mesma razão de creators.service.ts#create). Token cru só existe aqui, nesse retorno.
      const passwordHash = input.password ? await bcrypt.hash(input.password, 10) : null;
      const inviteToken = passwordHash ? null : generateOpaqueToken();

      return db.transaction(async (tx) => {
        const txUsersRepo = createUsersRepository(tx as typeof Db);
        const txCollaboratorsRepo = createCollaboratorsRepository(tx as typeof Db);

        const user = await txUsersRepo.create({
          tenantId,
          // Sem nome: usa o e-mail como placeholder visível até o Google substituir pelo nome real.
          name: input.name?.trim() || input.email,
          email: input.email,
          phone: input.phone ?? null,
          passwordHash,
          role: 'operacional',
          status: passwordHash ? 'active' : 'pending',
          inviteTokenHash: inviteToken ? hashToken(inviteToken) : null,
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
          avatarUrl: user.avatarUrl,
          status: user.status,
          ...(inviteToken ? { inviteToken } : {}),
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

        if (input.password !== undefined) {
          const passwordHash = await bcrypt.hash(input.password, 10);
          await txUsersRepo.updatePassword(row.userId, passwordHash);
        }

        const view = await txCollaboratorsRepo.findById(tenantId, id);
        if (!view) throw notFound('COLLABORATOR_NOT_FOUND', 'Colaborador não encontrado.');
        return view;
      });
    },

    /** Apaga o collaborator e o usuário/login vinculado na mesma transação — ver creators.service.ts. */
    async remove(tenantId: string, id: string) {
      return db.transaction(async (tx) => {
        const txCollaboratorsRepo = createCollaboratorsRepository(tx as typeof Db);
        const txUsersRepo = createUsersRepository(tx as typeof Db);

        const row = await txCollaboratorsRepo.findRowById(tenantId, id);
        if (!row) throw notFound('COLLABORATOR_NOT_FOUND', 'Colaborador não encontrado.');

        await txCollaboratorsRepo.deleteRow(tenantId, id);
        await txUsersRepo.deleteById(tenantId, row.userId);
      });
    },

    /** Gestor perdeu o link mostrado na criação (só aparece uma vez) — gera um token novo,
     * invalidando o anterior. Só faz sentido pra conta ainda 'pending' (ver creators.service.ts#regenerateInvite). */
    async regenerateInvite(tenantId: string, id: string): Promise<{ inviteToken: string }> {
      const row = await collaboratorsRepo.findRowById(tenantId, id);
      if (!row) throw notFound('COLLABORATOR_NOT_FOUND', 'Colaborador não encontrado.');

      const user = await usersRepo.findById(row.userId);
      if (!user || user.status !== 'pending') {
        throw conflict('NOT_PENDING', 'Essa conta já foi ativada — não há convite para gerar.');
      }

      const inviteToken = generateOpaqueToken();
      await usersRepo.regenerateInviteToken(user.id, hashToken(inviteToken));
      return { inviteToken };
    },
  };
}

export type CollaboratorsService = ReturnType<typeof createCollaboratorsService>;
