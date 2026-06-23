import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createRateLimiter } from './rateLimit.js';

/**
 * Instância própria com limite baixo — não usa env.loginRateLimitMax (que em .env.test é alto de
 * propósito, senão o resto da suíte, que loga várias vezes por arquivo, trombaria nele).
 */
function buildApp(max: number) {
  const app = express();
  app.use('/auth/login', createRateLimiter({ max, windowMs: 60_000 }), (_req, res) => res.json({ ok: true }));
  return app;
}

describe('createRateLimiter', () => {
  it('libera até o limite configurado', async () => {
    const app = buildApp(3);
    for (let i = 0; i < 3; i++) {
      const res = await request(app).post('/auth/login').send({});
      expect(res.status).toBe(200);
    }
  });

  it('bloqueia com 429 (TOO_MANY_ATTEMPTS) a partir da tentativa que excede o limite', async () => {
    const app = buildApp(3);
    for (let i = 0; i < 3; i++) {
      await request(app).post('/auth/login').send({});
    }
    const blocked = await request(app).post('/auth/login').send({});
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_ATTEMPTS');
  });
});
