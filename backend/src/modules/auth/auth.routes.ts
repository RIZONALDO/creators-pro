import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePlatformSecret } from '../../middleware/requirePlatformSecret.js';
import type { AuthService } from './auth.service.js';
import { loginSchema, provisionCompanySchema, refreshSchema } from './auth.schemas.js';

export function createAuthRouter(authService: AuthService) {
  const router = Router();

  router.post('/auth/login', async (req, res, next) => {
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
      const { refreshToken } = refreshSchema.parse(req.body);
      const result = await authService.refresh(refreshToken, req.headers['user-agent']);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post('/auth/logout', async (req, res, next) => {
    try {
      const { refreshToken } = refreshSchema.parse(req.body);
      await authService.logout(refreshToken);
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
