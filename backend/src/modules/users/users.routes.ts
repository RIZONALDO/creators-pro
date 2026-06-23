import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { parsePagination, paginatedResponse } from '../../lib/pagination.js';
import type { UsersAdminService } from './users.service.js';
import { newUserSchema, updateUserSchema } from './users.schemas.js';

/** Admin gerencia usuários (coordenadores/operacionais) diretamente — distinto de creators/collaborators. */
export function createUsersRouter(service: UsersAdminService) {
  const router = Router();
  router.use('/users', authenticate, authorize('admin'));

  router.get('/users', async (req, res, next) => {
    try {
      const pagination = parsePagination(req);
      const { rows, total } = await service.list(req.auth!.tenantId, pagination);
      res.json(paginatedResponse(rows, total, pagination));
    } catch (err) {
      next(err);
    }
  });

  router.post('/users', async (req, res, next) => {
    try {
      const input = newUserSchema.parse(req.body);
      const user = await service.create(req.auth!.tenantId, input);
      res.status(201).json(user);
    } catch (err) {
      next(err);
    }
  });

  router.put('/users/:id', async (req, res, next) => {
    try {
      const input = updateUserSchema.parse(req.body);
      const user = await service.update(req.auth!.tenantId, req.params.id!, input);
      res.json(user);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
