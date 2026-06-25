import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import type { OnboardingService } from './onboarding.service.js';

export function createOnboardingRouter(service: OnboardingService) {
  const router = Router();

  router.get('/onboarding/status', authenticate, async (req, res, next) => {
    try {
      const data = await service.getStatus(req.auth!);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
