import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { parsePagination, paginatedResponse } from '../../lib/pagination.js';
import type { AbsencesService } from './absences.service.js';
import { newAbsenceSchema, reviewAbsenceSchema } from './absences.schemas.js';

export function createAbsencesRouter(service: AbsencesService) {
  const router = Router();
  router.use('/absences', authenticate);

  router.get('/absences', async (req, res, next) => {
    try {
      const pagination = parsePagination(req);
      const { rows, total } = await service.list(req.auth!, pagination);
      res.json(paginatedResponse(rows, total, pagination));
    } catch (err) {
      next(err);
    }
  });

  // Sem authorize() de papel específico — a regra "só pode solicitar para si mesmo" é do operacional,
  // resolvida dentro do service (ver specs/03: admin/gestor também podem registrar em nome de um creator).
  router.post('/absences', async (req, res, next) => {
    try {
      const input = newAbsenceSchema.parse(req.body);
      const absence = await service.create(req.auth!, input);
      res.status(201).json(absence);
    } catch (err) {
      next(err);
    }
  });

  router.patch('/absences/:id/review', authorize('admin', 'gestor'), async (req, res, next) => {
    try {
      const { status } = reviewAbsenceSchema.parse(req.body);
      const absence = await service.review(req.auth!.tenantId, req.params.id!, status, req.auth!.userId);
      res.json(absence);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
