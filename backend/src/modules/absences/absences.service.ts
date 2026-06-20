import type { db as Db } from '../../db/client.js';
import type { AuthContext } from '../../middleware/authenticate.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import type { Pagination } from '../../lib/pagination.js';
import { createCreatorsRepository } from '../creators/creators.repository.js';
import { createStatusHistoryRepository } from '../statusHistory/statusHistory.repository.js';
import { createAbsencesRepository } from './absences.repository.js';
import type { newAbsenceSchema } from './absences.schemas.js';
import type { AbsenceStatus } from '../../db/schema/index.js';
import type { z } from 'zod';

export function createAbsencesService(db: typeof Db) {
  const absencesRepo = createAbsencesRepository(db);
  const creatorsRepo = createCreatorsRepository(db);

  return {
    /** operacional só vê as próprias ausências (resolvido pelo creator vinculado ao seu user_id). */
    async list(auth: AuthContext, pagination: Pagination) {
      if (auth.role === 'operacional') {
        const creator = await creatorsRepo.findRowByUserId(auth.tenantId, auth.userId);
        if (!creator) return { rows: [], total: 0 };
        return absencesRepo.list(auth.tenantId, pagination, { creatorId: creator.id });
      }
      return absencesRepo.list(auth.tenantId, pagination);
    },

    /**
     * operacional só pode solicitar para o próprio creator vinculado; admin/gestor pode
     * registrar em nome de qualquer creator do tenant (ex.: ausência reportada por telefone).
     */
    async create(auth: AuthContext, input: z.infer<typeof newAbsenceSchema>) {
      if (input.end_date < input.start_date) {
        throw badRequest('INVALID_DATE_RANGE', 'end_date não pode ser anterior a start_date.');
      }

      if (auth.role === 'operacional') {
        const own = await creatorsRepo.findRowByUserId(auth.tenantId, auth.userId);
        if (!own || own.id !== input.creator_id) {
          throw forbidden('CANNOT_REQUEST_FOR_OTHER_CREATOR', 'Você só pode solicitar ausência para si mesmo.');
        }
      } else {
        const creator = await creatorsRepo.findRowById(auth.tenantId, input.creator_id);
        if (!creator) throw badRequest('INVALID_CREATOR', 'Creator inválido para este tenant.');
      }

      return absencesRepo.create({
        tenantId: auth.tenantId,
        creatorId: input.creator_id,
        startDate: input.start_date,
        endDate: input.end_date,
        reason: input.reason ?? null,
      });
    },

    async review(tenantId: string, id: string, status: AbsenceStatus, reviewedBy: string) {
      return db.transaction(async (tx) => {
        const txAbsencesRepo = createAbsencesRepository(tx as typeof Db);
        const txHistoryRepo = createStatusHistoryRepository(tx as typeof Db);

        const existing = await txAbsencesRepo.findById(tenantId, id);
        if (!existing) throw notFound('ABSENCE_NOT_FOUND', 'Ausência não encontrada.');

        const updated = await txAbsencesRepo.review(tenantId, id, status, reviewedBy);
        await txHistoryRepo.record({
          tenantId,
          entityType: 'absence',
          entityId: id,
          oldStatus: existing.status,
          newStatus: status,
          changedBy: reviewedBy,
        });

        // TODO (Fase 6): emitir notification 'alteracao_escala' pro(s) coordenador(es) quando a
        // ausência aprovada sobrepõe um dia já escalado — ver specs/06-regras-de-negocio.md.
        // Não implementado aqui porque a tabela `notifications` só existe a partir da Fase 6.

        return updated;
      });
    },
  };
}

export type AbsencesService = ReturnType<typeof createAbsencesService>;
