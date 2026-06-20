import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { parsePagination, paginatedResponse } from '../../lib/pagination.js';
import type { TasksService } from './tasks.service.js';
import { newTaskSchema, setTaskStatusSchema, updateTaskSchema } from './tasks.schemas.js';

export function createTasksRouter(service: TasksService) {
  const router = Router();
  router.use('/tasks', authenticate);

  // GET é liberado pro operacional também — a service já filtra "só o que é meu".
  router.get('/tasks', async (req, res, next) => {
    try {
      const pagination = parsePagination(req);
      const { rows, total } = await service.list(req.auth!, pagination);
      res.json(paginatedResponse(rows, total, pagination));
    } catch (err) {
      next(err);
    }
  });

  router.post('/tasks', authorize('admin', 'gestor'), async (req, res, next) => {
    try {
      const input = newTaskSchema.parse(req.body);
      const task = await service.create(req.auth!.tenantId, req.auth!.userId, input);
      res.status(201).json(task);
    } catch (err) {
      next(err);
    }
  });

  router.put('/tasks/:id', authorize('admin', 'gestor'), async (req, res, next) => {
    try {
      const input = updateTaskSchema.parse(req.body);
      const task = await service.update(req.auth!.tenantId, req.params.id!, input);
      res.json(task);
    } catch (err) {
      next(err);
    }
  });

  router.patch('/tasks/:id/status', authorize('admin', 'gestor'), async (req, res, next) => {
    try {
      const { status } = setTaskStatusSchema.parse(req.body);
      const task = await service.setStatus(req.auth!.tenantId, req.params.id!, status, req.auth!.userId);
      res.json(task);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
