import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { notFound } from '../../lib/errors.js';
import { parsePagination, paginatedResponse } from '../../lib/pagination.js';
import type { ClientsRepository } from './clients.repository.js';
import { newClientSchema, updateClientSchema } from './clients.schemas.js';

export function createClientsRouter(repo: ClientsRepository) {
  const router = Router();
  router.use('/clients', authenticate, authorize('admin', 'gestor'));

  router.get('/clients', async (req, res, next) => {
    try {
      const pagination = parsePagination(req);
      const { rows, total } = await repo.list(req.auth!.tenantId, pagination);
      res.json(paginatedResponse(rows, total, pagination));
    } catch (err) {
      next(err);
    }
  });

  router.post('/clients', async (req, res, next) => {
    try {
      const input = newClientSchema.parse(req.body);
      const client = await repo.create(req.auth!.tenantId, input);
      res.status(201).json(client);
    } catch (err) {
      next(err);
    }
  });

  router.put('/clients/:id', async (req, res, next) => {
    try {
      const input = updateClientSchema.parse(req.body);
      const client = await repo.update(req.auth!.tenantId, req.params.id, input);
      if (!client) throw notFound('CLIENT_NOT_FOUND', 'Cliente não encontrado.');
      res.json(client);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/clients/:id', async (req, res, next) => {
    try {
      const deleted = await repo.delete(req.auth!.tenantId, req.params.id);
      if (!deleted) throw notFound('CLIENT_NOT_FOUND', 'Cliente não encontrado.');
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
