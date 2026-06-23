import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { parsePagination, paginatedResponse } from '../../lib/pagination.js';
import type { ShiftsService } from './shifts.service.js';
import { newShiftSchema, setShiftStatusSchema, updateShiftSchema } from './shifts.schemas.js';

export function createShiftsRouter(service: ShiftsService) {
  const router = Router();
  router.use('/shifts', authenticate);

  router.get('/shifts', async (req, res, next) => {
    try {
      const pagination = parsePagination(req);
      const { rows, total } = await service.list(req.auth!, pagination);
      res.json(paginatedResponse(rows, total, pagination));
    } catch (err) {
      next(err);
    }
  });

  router.post('/shifts', authorize('admin', 'gestor'), async (req, res, next) => {
    try {
      const input = newShiftSchema.parse(req.body);
      const shift = await service.create(req.auth!.tenantId, req.auth!.userId, input);
      res.status(201).json(shift);
    } catch (err) {
      next(err);
    }
  });

  router.put('/shifts/:id', authorize('admin', 'gestor'), async (req, res, next) => {
    try {
      const input = updateShiftSchema.parse(req.body);
      const shift = await service.update(req.auth!.tenantId, req.params.id!, input);
      res.json(shift);
    } catch (err) {
      next(err);
    }
  });

  router.patch('/shifts/:id/status', authorize('admin', 'gestor'), async (req, res, next) => {
    try {
      const { status } = setShiftStatusSchema.parse(req.body);
      const shift = await service.setStatus(req.auth!.tenantId, req.params.id!, status, req.auth!.userId);
      res.json(shift);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/shifts/:id', authorize('admin', 'gestor'), async (req, res, next) => {
    try {
      await service.remove(req.auth!.tenantId, req.params.id!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
