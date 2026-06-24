import bcrypt from 'bcryptjs';
import type { db as Db } from '../../db/client.js';
import { conflict, notFound } from '../../lib/errors.js';
import type { Pagination } from '../../lib/pagination.js';
import { generateOpaqueToken, hashToken } from '../../lib/tokens.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { createCreatorsRepository, type CreatorView } from './creators.repository.js';
import type { newCreatorSchema, updateCreatorSchema } from './creators.schemas.js';
import type { z } from 'zod';

export function createCreatorsService(db: typeof Db) {
  const creatorsRepo = createCreatorsRepository(db);
  const usersRepo = createUsersRepository(db);

  return {
    async list(tenantId: string, pagination: Pagination) {
      return creatorsRepo.list(tenantId, pagination);
    },

    async create(tenantId: string, input: z.infer<typeof newCreatorSchema>): Promise<CreatorView & { inviteToken?: string }> {
      const existingUser = await usersRepo.findByEmail(input.email);
      if (existingUser) throw conflict('EMAIL_TAKEN', 'Já existe um usuário com este e-mail.');

      // Sem senha: conta nasce 'pending' (convite só com e-mail) — login só via Google, que captura
      // o nome real e ativa a conta no primeiro acesso. Token de convite: única forma de reivindicar
      // essa conta (e-mail batendo no Google não basta sozinho — ver auth.service.ts#loginWithGoogle
      // pro motivo). Token cru só existe aqui, nesse retorno — depois só o hash fica salvo,
      // ninguém recupera esse link de novo se o gestor perder.
      const passwordHash = input.password ? await bcrypt.hash(input.password, 10) : null;
      const inviteToken = passwordHash ? null : generateOpaqueToken();

      return db.transaction(async (tx) => {
        const txUsersRepo = createUsersRepository(tx as typeof Db);
        const txCreatorsRepo = createCreatorsRepository(tx as typeof Db);

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

        const creatorRow = await txCreatorsRepo.createRow({
          tenantId,
          userId: user.id,
          employmentType: input.employment_type,
          active: input.active ?? true,
        });

        return {
          id: creatorRow.id,
          tenantId: creatorRow.tenantId,
          userId: creatorRow.userId,
          employmentType: creatorRow.employmentType,
          active: creatorRow.active,
          createdAt: creatorRow.createdAt,
          name: user.name,
          email: user.email,
          phone: user.phone,
          avatarUrl: user.avatarUrl,
          status: user.status,
          ...(inviteToken ? { inviteToken } : {}),
        };
      });
    },

    async update(tenantId: string, id: string, input: z.infer<typeof updateCreatorSchema>): Promise<CreatorView> {
      return db.transaction(async (tx) => {
        const txUsersRepo = createUsersRepository(tx as typeof Db);
        const txCreatorsRepo = createCreatorsRepository(tx as typeof Db);

        const creatorRow = await txCreatorsRepo.findRowById(tenantId, id);
        if (!creatorRow) throw notFound('CREATOR_NOT_FOUND', 'Creator não encontrado.');

        if (input.employment_type !== undefined || input.active !== undefined) {
          await txCreatorsRepo.updateRow(tenantId, id, {
            ...(input.employment_type !== undefined ? { employmentType: input.employment_type } : {}),
            ...(input.active !== undefined ? { active: input.active } : {}),
          });
        }

        if (input.name !== undefined || input.email !== undefined || input.phone !== undefined) {
          if (input.email !== undefined) {
            const existing = await txUsersRepo.findByEmail(input.email);
            if (existing && existing.id !== creatorRow.userId) {
              throw conflict('EMAIL_TAKEN', 'Já existe um usuário com este e-mail.');
            }
          }
          await txUsersRepo.updateProfile(creatorRow.userId, {
            name: input.name,
            email: input.email,
            phone: input.phone,
          });
        }

        if (input.password !== undefined) {
          const passwordHash = await bcrypt.hash(input.password, 10);
          await txUsersRepo.updatePassword(creatorRow.userId, passwordHash);
        }

        const view = await txCreatorsRepo.findById(tenantId, id);
        if (!view) throw notFound('CREATOR_NOT_FOUND', 'Creator não encontrado.');
        return view;
      });
    },

    /**
     * Apaga o creator e o usuário/login vinculado na mesma transação — sem fluxo de "creator sem
     * conta", a conta não tem propósito sozinha. Bloqueado pelo Postgres (RESTRICT) se houver
     * task/serviço/escala/ausência/plantão vinculado — nesse caso nem o usuário chega a ser tocado.
     */
    async remove(tenantId: string, id: string) {
      return db.transaction(async (tx) => {
        const txCreatorsRepo = createCreatorsRepository(tx as typeof Db);
        const txUsersRepo = createUsersRepository(tx as typeof Db);

        const creatorRow = await txCreatorsRepo.findRowById(tenantId, id);
        if (!creatorRow) throw notFound('CREATOR_NOT_FOUND', 'Creator não encontrado.');

        await txCreatorsRepo.deleteRow(tenantId, id);
        await txUsersRepo.deleteById(tenantId, creatorRow.userId);
      });
    },

    /** Ordem definida por drag na paleta da Escala — base do round-robin da escala automática (listActiveIds). */
    async reorder(tenantId: string, creatorIds: string[]) {
      await creatorsRepo.reorder(tenantId, creatorIds);
    },

    /** Gestor perdeu o link mostrado na criação (só aparece uma vez) — gera um token novo,
     * invalidando o anterior. Só faz sentido pra conta ainda 'pending'; uma já ativa não tem
     * convite pra reenviar (ver auth.service.ts#claimInviteWithGoogle). */
    async regenerateInvite(tenantId: string, id: string): Promise<{ inviteToken: string }> {
      const creatorRow = await creatorsRepo.findRowById(tenantId, id);
      if (!creatorRow) throw notFound('CREATOR_NOT_FOUND', 'Creator não encontrado.');

      const user = await usersRepo.findById(creatorRow.userId);
      if (!user || user.status !== 'pending') {
        throw conflict('NOT_PENDING', 'Essa conta já foi ativada — não há convite para gerar.');
      }

      const inviteToken = generateOpaqueToken();
      await usersRepo.regenerateInviteToken(user.id, hashToken(inviteToken));
      return { inviteToken };
    },
  };
}

export type CreatorsService = ReturnType<typeof createCreatorsService>;
