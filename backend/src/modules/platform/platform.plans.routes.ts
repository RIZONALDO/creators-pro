import { Router } from 'express';
import { z } from 'zod';
import { authenticatePlatform } from '../../middleware/authenticatePlatform.js';
import type { PlatformPlansService } from './platform.plans.service.js';

const createPlanSchema = z.object({
  name: z.string().min(2),
  billingType: z.enum(['monthly', 'yearly', 'one_time', 'manual']),
  priceCents: z.number().int().min(0),
  currency: z.string().length(3).optional(),
  maxGestores: z.number().int().positive().nullable().optional(),
  maxCreators: z.number().int().positive().nullable().optional(),
  syncStripe: z.boolean().optional(),
  stripeImportPriceId: z.string().optional(),
});

const updatePlanSchema = z.object({
  name: z.string().min(2).optional(),
  priceCents: z.number().int().min(0).optional(),
  maxGestores: z.number().int().positive().nullable().optional(),
  maxCreators: z.number().int().positive().nullable().optional(),
  stripeImportPriceId: z.string().optional(),
});

export function createPlatformPlansRouter(service: PlatformPlansService) {
  const router = Router();

  // Preview de um price_id do Stripe — retorna nome do produto, valor, moeda e tipo de cobrança
  router.get('/platform/plans/stripe-price-preview', authenticatePlatform, async (req, res, next) => {
    try {
      const priceId = z.string().min(1).parse(req.query['priceId']);
      res.json(await service.previewStripePrice(priceId));
    } catch (err) {
      next(err);
    }
  });

  router.get('/platform/plans', authenticatePlatform, async (_req, res, next) => {
    try {
      res.json(await service.list());
    } catch (err) {
      next(err);
    }
  });

  router.get('/platform/plans/:id', authenticatePlatform, async (req, res, next) => {
    try {
      res.json(await service.getById(req.params.id!));
    } catch (err) {
      next(err);
    }
  });

  router.post('/platform/plans', authenticatePlatform, async (req, res, next) => {
    try {
      const input = createPlanSchema.parse(req.body);
      res.status(201).json(await service.create(input));
    } catch (err) {
      next(err);
    }
  });

  router.put('/platform/plans/:id', authenticatePlatform, async (req, res, next) => {
    try {
      const input = updatePlanSchema.parse(req.body);
      res.json(await service.update(req.params.id!, input));
    } catch (err) {
      next(err);
    }
  });

  router.delete('/platform/plans/:id', authenticatePlatform, async (req, res, next) => {
    try {
      res.json(await service.deletePlan(req.params.id!));
    } catch (err) {
      next(err);
    }
  });

  router.post('/platform/plans/:id/sync-stripe', authenticatePlatform, async (req, res, next) => {
    try {
      res.json(await service.syncStripeById(req.params.id!));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
