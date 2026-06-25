import { Router } from 'express';
import { z } from 'zod';
import { authenticatePlatform } from '../../middleware/authenticatePlatform.js';
import { platformLoginSchema } from './platform.auth.schemas.js';
import type { PlatformAuthService } from './platform.auth.service.js';

const totpVerifySchema = z.object({ adminId: z.string().uuid(), code: z.string().length(6) });
const totpCodeSchema = z.object({ code: z.string().length(6) });
const totpConfirmSchema = z.object({ secret: z.string().min(16), code: z.string().length(6) });

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

  router.post('/platform/auth/totp', async (req, res, next) => {
    try {
      const { adminId, code } = totpVerifySchema.parse(req.body);
      res.json(await authService.verifyTotp(adminId, code));
    } catch (err) {
      next(err);
    }
  });

  router.get('/platform/auth/me', authenticatePlatform, async (req, res, next) => {
    try {
      res.json(await authService.me(req.platformAdmin!.id));
    } catch (err) {
      next(err);
    }
  });

  router.post('/platform/auth/totp/setup', authenticatePlatform, async (req, res, next) => {
    try {
      res.json(await authService.setupTotp(req.platformAdmin!.id));
    } catch (err) {
      next(err);
    }
  });

  router.post('/platform/auth/totp/confirm', authenticatePlatform, async (req, res, next) => {
    try {
      const { secret, code } = totpConfirmSchema.parse(req.body);
      res.json(await authService.confirmTotp(req.platformAdmin!.id, secret, code));
    } catch (err) {
      next(err);
    }
  });

  router.delete('/platform/auth/totp', authenticatePlatform, async (req, res, next) => {
    try {
      const { code } = totpCodeSchema.parse(req.body);
      res.json(await authService.disableTotp(req.platformAdmin!.id, code));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
