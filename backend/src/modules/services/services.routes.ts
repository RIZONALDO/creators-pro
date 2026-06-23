import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { parsePagination, paginatedResponse } from '../../lib/pagination.js';
import type { ServicesService } from './services.service.js';
import { newServiceSchema, setServiceStatusSchema, updateServiceSchema } from './services.schemas.js';

export function createServicesRouter(service: ServicesService) {
  const router = Router();
  router.use('/services', authenticate);

  router.get('/services', async (req, res, next) => {
    try {
      const pagination = parsePagination(req);
      const { rows, total } = await service.list(req.auth!, pagination);
      res.json(paginatedResponse(rows, total, pagination));
    } catch (err) {
      next(err);
    }
  });

  router.post('/services', authorize('admin', 'gestor'), async (req, res, next) => {
    try {
      const input = newServiceSchema.parse(req.body);
      const created = await service.create(req.auth!.tenantId, req.auth!.userId, input);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });

  router.put('/services/:id', authorize('admin', 'gestor'), async (req, res, next) => {
    try {
      const input = updateServiceSchema.parse(req.body);
      const updated = await service.update(req.auth!.tenantId, req.params.id!, input);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  router.patch('/services/:id/status', authorize('admin', 'gestor'), async (req, res, next) => {
    try {
      const { status } = setServiceStatusSchema.parse(req.body);
      const updated = await service.setStatus(req.auth!.tenantId, req.params.id!, status, req.auth!.userId);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/services/:id', authorize('admin', 'gestor'), async (req, res, next) => {
    try {
      await service.remove(req.auth!.tenantId, req.params.id!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
