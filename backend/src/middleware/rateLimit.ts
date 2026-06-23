import rateLimit from 'express-rate-limit';

/**
 * Proteção básica contra abuso em rotas públicas sensíveis (Fase 9 — hardening): /auth/login
 * (brute-force) e /signup (spam de Checkout Session). Fábrica, não singleton: o teste dedicado
 * (rateLimit.test.ts) constrói a própria instância com limite baixo, sem depender/mexer no valor
 * configurado via env (que em .env.test é alto de propósito, senão o resto da suíte trombaria nele).
 */
export function createRateLimiter(opts?: { windowMs?: number; max?: number; code?: string; message?: string }) {
  return rateLimit({
    windowMs: opts?.windowMs ?? 15 * 60 * 1000,
    limit: opts?.max ?? 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: {
        code: opts?.code ?? 'TOO_MANY_ATTEMPTS',
        message: opts?.message ?? 'Muitas tentativas. Tente novamente em alguns minutos.',
      },
    },
  });
}
