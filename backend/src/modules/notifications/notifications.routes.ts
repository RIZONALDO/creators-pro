import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { parsePagination, paginatedResponse } from '../../lib/pagination.js';
import type { NotificationsService } from './notifications.service.js';

export function createNotificationsRouter(service: NotificationsService) {
  const router = Router();
  router.use('/notifications', authenticate);

  router.get('/notifications', async (req, res, next) => {
    try {
      const pagination = parsePagination(req);
      const { rows, total } = await service.list(req.auth!, pagination);
      res.json(paginatedResponse(rows, total, pagination));
    } catch (err) {
      next(err);
    }
  });

  router.post('/notifications/read-all', async (req, res, next) => {
    try {
      await service.markAllRead(req.auth!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
