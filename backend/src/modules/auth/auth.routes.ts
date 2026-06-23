import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePlatformSecret } from '../../middleware/requirePlatformSecret.js';
import { createRateLimiter } from '../../middleware/rateLimit.js';
import { env } from '../../lib/env.js';
import type { AuthService } from './auth.service.js';
import { loginSchema, provisionCompanySchema, refreshSchema } from './auth.schemas.js';

export function createAuthRouter(authService: AuthService) {
  const router = Router();
  const loginRateLimiter = createRateLimiter({
    max: env.loginRateLimitMax,
    windowMs: env.loginRateLimitWindowMs,
    code: 'TOO_MANY_ATTEMPTS',
    message: 'Muitas tentativas de login. Tente novamente em alguns minutos.',
  });

  router.post('/auth/login', loginRateLimiter, async (req, res, next) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const result = await authService.login(email, password, req.headers['user-agent']);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post('/auth/refresh', async (req, res, next) => {
    try {
      const { refresh_token } = refreshSchema.parse(req.body);
      const result = await authService.refresh(refresh_token, req.headers['user-agent']);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post('/auth/logout', async (req, res, next) => {
    try {
      const { refresh_token } = refreshSchema.parse(req.body);
      await authService.logout(refresh_token);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  router.get('/auth/me', authenticate, async (req, res, next) => {
    try {
      const user = await authService.me(req.auth!.userId);
      res.json({ user });
    } catch (err) {
      next(err);
    }
  });

  router.post('/internal/companies', requirePlatformSecret, async (req, res, next) => {
    try {
      const input = provisionCompanySchema.parse(req.body);
      const result = await authService.provisionCompany(input);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
