import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import type { ScheduleService } from './schedule.service.js';
import { assignCreatorSchema, duplicateMonthSchema, newHolidaySchema } from './schedule.schemas.js';

export function createScheduleRouter(service: ScheduleService) {
  const router = Router();

  // Leitura liberada pra todo papel autenticado (admin/gestor/operacional veem a escala do mês).
  router.get('/scale-entries', authenticate, async (req, res, next) => {
    try {
      const { scaleMonth, entries } = await service.listEntries(req.auth!.tenantId, req.query.month, req.auth!.userId);
      res.json({ data: entries, scale_month_id: scaleMonth.id });
    } catch (err) {
      next(err);
    }
  });

  // Adiciona 1 creator a 1 dia — não substitui quem já estiver escalado (mais de 1 por dia é permitido).
  router.post('/scale-entries/:work_date', authenticate, authorize('admin', 'gestor'), async (req, res, next) => {
    try {
      const { creator_id } = assignCreatorSchema.parse(req.body);
      const entry = await service.assign(req.auth!.tenantId, req.params.work_date, creator_id, req.auth!.userId);
      res.status(201).json(entry);
    } catch (err) {
      next(err);
    }
  });

  // Remove 1 creator de 1 dia, sem afetar outros creators atribuídos no mesmo dia.
  router.delete('/scale-entries/:work_date/:creator_id', authenticate, authorize('admin', 'gestor'), async (req, res, next) => {
    try {
      await service.unassign(req.auth!.tenantId, req.params.work_date, req.params.creator_id!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  router.post('/scale-months/:id/auto-assign', authenticate, authorize('admin', 'gestor'), async (req, res, next) => {
    try {
      const entries = await service.autoAssign(req.auth!.tenantId, req.params.id!);
      res.json({ data: entries });
    } catch (err) {
      next(err);
    }
  });

  router.post('/scale-months/:id/duplicate', authenticate, authorize('admin', 'gestor'), async (req, res, next) => {
    try {
      const { target_month, target_year } = duplicateMonthSchema.parse(req.body);
      const { scaleMonth, entries } = await service.duplicateMonth(req.auth!.tenantId, req.params.id!, target_month, target_year, req.auth!.userId);
      res.json({ data: entries, scale_month_id: scaleMonth.id });
    } catch (err) {
      next(err);
    }
  });

  router.get('/holidays', authenticate, async (req, res, next) => {
    try {
      res.json({ data: await service.holidays.list(req.auth!.tenantId, req.query.month) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/holidays', authenticate, authorize('admin', 'gestor'), async (req, res, next) => {
    try {
      const { holiday_date, description } = newHolidaySchema.parse(req.body);
      const holiday = await service.holidays.create(req.auth!.tenantId, holiday_date, description ?? null);
      res.status(201).json(holiday);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
