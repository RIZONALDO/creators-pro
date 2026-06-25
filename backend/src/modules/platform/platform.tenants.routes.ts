import { Router } from 'express';
import { z } from 'zod';
import { authenticatePlatform } from '../../middleware/authenticatePlatform.js';
import type { PlatformTenantsService } from './platform.tenants.service.js';
import type { CompanyStatus } from '../../db/schema/index.js';

const createTenantSchema = z.object({
  name: z.string().min(2),
  adminName: z.string().min(2),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
});

const updateStatusSchema = z.object({
  status: z.enum(['active', 'suspended', 'cancelled', 'trial']),
});

const updatePlanSchema = z.object({
  planId: z.string().uuid().nullable(),
  planOverride: z.record(z.unknown()).nullable().optional(),
  lifetime: z.boolean().optional(),
});

export function createPlatformTenantsRouter(service: PlatformTenantsService) {
  const router = Router();

  router.get('/platform/tenants', authenticatePlatform, async (_req, res, next) => {
    try {
      res.json(await service.list());
    } catch (err) {
      next(err);
    }
  });

  router.post('/platform/tenants', authenticatePlatform, async (req, res, next) => {
    try {
      const input = createTenantSchema.parse(req.body);
      const company = await service.create(input);
      res.status(201).json(company);
    } catch (err) {
      next(err);
    }
  });

  router.get('/platform/tenants/:id', authenticatePlatform, async (req, res, next) => {
    try {
      res.json(await service.getWithMetrics(req.params.id!));
    } catch (err) {
      next(err);
    }
  });

  router.patch('/platform/tenants/:id/status', authenticatePlatform, async (req, res, next) => {
    try {
      const { status } = updateStatusSchema.parse(req.body);
      res.json(await service.updateStatus(req.params.id!, status as CompanyStatus));
    } catch (err) {
      next(err);
    }
  });

  router.patch('/platform/tenants/:id/plan', authenticatePlatform, async (req, res, next) => {
    try {
      const input = updatePlanSchema.parse(req.body);
      res.json(await service.updatePlan(req.params.id!, input));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
