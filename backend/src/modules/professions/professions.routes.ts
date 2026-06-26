import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import type { ProfessionsService } from './professions.service.js';

const newProfessionSchema = z.object({ name: z.string().min(1) });

export function createProfessionsRouter(service: ProfessionsService) {
  const router = Router();
  router.use('/professions', authenticate, authorize('admin', 'gestor'));

  router.get('/professions', async (req, res, next) => {
    try {
      res.json({ data: await service.list(req.auth!.tenantId) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/professions', async (req, res, next) => {
    try {
      const { name } = newProfessionSchema.parse(req.body);
      res.status(201).json(await service.create(req.auth!.tenantId, name));
    } catch (err) {
      next(err);
    }
  });

  router.delete('/professions/:id', async (req, res, next) => {
    try {
      await service.remove(req.auth!.tenantId, req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
