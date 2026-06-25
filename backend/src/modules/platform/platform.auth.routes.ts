import { Router } from 'express';
import { authenticatePlatform } from '../../middleware/authenticatePlatform.js';
import { platformLoginSchema } from './platform.auth.schemas.js';
import type { PlatformAuthService } from './platform.auth.service.js';

export function createPlatformAuthRouter(authService: PlatformAuthService) {
  const router = Router();

  router.post('/platform/auth/login', async (req, res, next) => {
    try {
      const { email, password } = platformLoginSchema.parse(req.body);
      const result = await authService.login(email, password);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.get('/platform/auth/me', authenticatePlatform, async (req, res, next) => {
    try {
      const admin = await authService.me(req.platformAdmin!.id);
      res.json(admin);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
