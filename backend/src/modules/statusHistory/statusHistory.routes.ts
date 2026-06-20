import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { badRequest } from '../../lib/errors.js';
import type { StatusHistoryRepository } from './statusHistory.repository.js';

const queryHistoryEntitySchema = z.enum(['task', 'absence', 'shift', 'service']);

export function createStatusHistoryRouter(repo: StatusHistoryRepository) {
  const router = Router();
  router.use('/status-history', authenticate, authorize('admin', 'gestor'));

  router.get('/status-history', async (req, res, next) => {
    try {
      const entityType = queryHistoryEntitySchema.safeParse(req.query.entity_type);
      const entityId = typeof req.query.entity_id === 'string' ? req.query.entity_id : undefined;
      if (!entityType.success || !entityId) {
        throw badRequest('INVALID_QUERY', 'entity_type e entity_id são obrigatórios.');
      }

      const data = await repo.list(req.auth!.tenantId, entityType.data, entityId);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
