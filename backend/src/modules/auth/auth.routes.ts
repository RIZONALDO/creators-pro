import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePlatformSecret } from '../../middleware/requirePlatformSecret.js';
import { createRateLimiter } from '../../middleware/rateLimit.js';
import { env } from '../../lib/env.js';
import type { AuthService } from './auth.service.js';
import { claimInviteSchema, forgotPasswordSchema, googleLoginSchema, loginSchema, provisionCompanySchema, refreshSchema, resetPasswordSchema } from './auth.schemas.js';

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

  // Mesmo rate limiter de /auth/login — mesma superfície de abuso (tentar emails ao acaso).
  router.post('/auth/google', loginRateLimiter, async (req, res, next) => {
    try {
      const { id_token } = googleLoginSchema.parse(req.body);
      const result = await authService.loginWithGoogle(id_token, req.headers['user-agent']);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Sem authenticate — quem chega aqui ainda não tem conta ativa nenhuma; é a própria reivindicação
  // que cria a sessão. Mesmo rate limiter (tentar tokens/e-mails ao acaso é a mesma superfície de abuso).
  router.post('/auth/google/claim', loginRateLimiter, async (req, res, next) => {
    try {
      const { token, id_token } = claimInviteSchema.parse(req.body);
      const result = await authService.claimInviteWithGoogle(token, id_token, req.headers['user-agent']);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Mesmo rate limiter de /auth/login — sem isso, alguém poderia espetar o e-mail de outra
  // pessoa repetidamente (spam de e-mail) ou tentar enumerar quais e-mails existem pelo tempo de resposta.
  router.post('/auth/forgot-password', loginRateLimiter, async (req, res, next) => {
    try {
      const { email } = forgotPasswordSchema.parse(req.body);
      await authService.requestPasswordReset(email);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  // Sem authenticate — quem chega aqui ainda não tem sessão (perdeu a senha); o próprio token do
  // e-mail é a prova de identidade. Mesmo rate limiter (tentar tokens ao acaso é a mesma superfície de abuso).
  router.post('/auth/reset-password', loginRateLimiter, async (req, res, next) => {
    try {
      const { token, password } = resetPasswordSchema.parse(req.body);
      const result = await authService.resetPassword(token, password, req.headers['user-agent']);
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
