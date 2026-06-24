import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { parsePagination, paginatedResponse } from '../../lib/pagination.js';
import type { CollaboratorsService } from './collaborators.service.js';
import { newCollaboratorSchema, updateCollaboratorSchema } from './collaborators.schemas.js';

export function createCollaboratorsRouter(service: CollaboratorsService) {
  const router = Router();
  router.use('/collaborators', authenticate, authorize('admin', 'gestor'));

  router.get('/collaborators', async (req, res, next) => {
    try {
      const pagination = parsePagination(req);
      const { rows, total } = await service.list(req.auth!.tenantId, pagination);
      res.json(paginatedResponse(rows, total, pagination));
    } catch (err) {
      next(err);
    }
  });

  router.post('/collaborators', async (req, res, next) => {
    try {
      const input = newCollaboratorSchema.parse(req.body);
      const collaborator = await service.create(req.auth!.tenantId, input);
      res.status(201).json(collaborator);
    } catch (err) {
      next(err);
    }
  });

  router.put('/collaborators/:id', async (req, res, next) => {
    try {
      const input = updateCollaboratorSchema.parse(req.body);
      const collaborator = await service.update(req.auth!.tenantId, req.params.id, input);
      res.json(collaborator);
    } catch (err) {
      next(err);
    }
  });

  // Gera um novo link de convite — só pra conta ainda 'pending' (ver service.regenerateInvite).
  router.post('/collaborators/:id/invite', async (req, res, next) => {
    try {
      const result = await service.regenerateInvite(req.auth!.tenantId, req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/collaborators/:id', async (req, res, next) => {
    try {
      await service.remove(req.auth!.tenantId, req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
