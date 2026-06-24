import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { parsePagination, paginatedResponse } from '../../lib/pagination.js';
import type { CreatorsService } from './creators.service.js';
import { newCreatorSchema, reorderCreatorsSchema, updateCreatorSchema } from './creators.schemas.js';

export function createCreatorsRouter(service: CreatorsService) {
  const router = Router();
  router.use('/creators', authenticate, authorize('admin', 'gestor'));

  router.get('/creators', async (req, res, next) => {
    try {
      const pagination = parsePagination(req);
      const { rows, total } = await service.list(req.auth!.tenantId, pagination);
      res.json(paginatedResponse(rows, total, pagination));
    } catch (err) {
      next(err);
    }
  });

  router.post('/creators', async (req, res, next) => {
    try {
      const input = newCreatorSchema.parse(req.body);
      const creator = await service.create(req.auth!.tenantId, input);
      res.status(201).json(creator);
    } catch (err) {
      next(err);
    }
  });

  // Precisa vir ANTES de PUT /creators/:id — senão Express trata "reorder" como valor de :id.
  router.put('/creators/reorder', async (req, res, next) => {
    try {
      const { creator_ids } = reorderCreatorsSchema.parse(req.body);
      await service.reorder(req.auth!.tenantId, creator_ids);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  router.put('/creators/:id', async (req, res, next) => {
    try {
      const input = updateCreatorSchema.parse(req.body);
      const creator = await service.update(req.auth!.tenantId, req.params.id, input);
      res.json(creator);
    } catch (err) {
      next(err);
    }
  });

  // Gera um novo link de convite — só pra conta ainda 'pending' (ver service.regenerateInvite).
  router.post('/creators/:id/invite', async (req, res, next) => {
    try {
      const result = await service.regenerateInvite(req.auth!.tenantId, req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/creators/:id', async (req, res, next) => {
    try {
      await service.remove(req.auth!.tenantId, req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
