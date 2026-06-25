import { Router, type Request, type Response, type NextFunction } from 'express';
import type Stripe from 'stripe';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { createRateLimiter } from '../../middleware/rateLimit.js';
import { stripeClient } from '../../lib/stripe.js';
import { env } from '../../lib/env.js';
import { badRequest } from '../../lib/errors.js';
import { signupSchema, trialSignupSchema, upgradeTrialSchema } from './billing.schemas.js';
import type { BillingService } from './billing.service.js';

export function createBillingRouter(service: BillingService) {
  const router = Router();

  // Spam de Checkout Session é diferente de brute-force de senha, mas o mecanismo é o mesmo (Fase 9).
  const signupRateLimiter = createRateLimiter({
    max: 5,
    windowMs: 60 * 60 * 1000,
    code: 'TOO_MANY_SIGNUPS',
    message: 'Muitas tentativas de cadastro. Tente novamente mais tarde.',
  });

  router.post('/signup', signupRateLimiter, async (req, res, next) => {
    try {
      const input = signupSchema.parse(req.body);
      const result = await service.startSignup(input);
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  });

  // Sem cartão, sem Stripe — cria a empresa direto e já devolve sessão (ver service.startTrial).
  router.post('/signup/trial', signupRateLimiter, async (req, res, next) => {
    try {
      const input = trialSignupSchema.parse(req.body);
      const result = await service.startTrial(input);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  // Sem authenticate de propósito: se o trial já venceu, o login normal está bloqueado (não tem
  // como chegar a um token) — confirmar e-mail+senha de novo é o único jeito de provar identidade
  // pra abrir o checkout. Mesmo rate limiter de login/signup (mesma superfície de abuso).
  router.post('/billing/upgrade-trial', signupRateLimiter, async (req, res, next) => {
    try {
      const input = upgradeTrialSchema.parse(req.body);
      const result = await service.upgradeTrial(input);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  });

  router.post('/billing/portal', authenticate, authorize('admin'), async (req, res, next) => {
    try {
      const result = await service.createPortalSession(req.auth!);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  });

  router.get('/billing/status', authenticate, authorize('admin'), async (req, res, next) => {
    try {
      const result = await service.getStatus(req.auth!);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

/**
 * Montado separadamente em app.ts, ANTES do express.json() global — a verificação de assinatura
 * do Stripe exige os bytes crus do corpo (express.raw), não o objeto já parseado. `stripe`/
 * `webhookSecret` injetáveis (mesmo padrão de createBillingService) — billing.routes.test.ts gera
 * uma assinatura válida com um secret falso, sem precisar de chave real da Stripe.
 */
export function createBillingWebhookHandler(
  service: BillingService,
  stripe: Stripe | null = stripeClient,
  webhookSecret: string | undefined = env.stripeWebhookSecret,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!stripe || !webhookSecret) {
        throw badRequest('BILLING_NOT_CONFIGURED', 'Cobrança ainda não configurada neste ambiente.');
      }
      const signature = req.headers['stripe-signature'];
      if (!signature || typeof signature !== 'string') {
        throw badRequest('MISSING_SIGNATURE', 'Assinatura do webhook ausente.');
      }

      let event;
      try {
        event = stripe.webhooks.constructEvent(req.body as Buffer, signature, webhookSecret);
      } catch {
        // assinatura inválida/corpo adulterado é input ruim (alguém forjando o webhook), não erro interno.
        throw badRequest('INVALID_SIGNATURE', 'Assinatura do webhook inválida.');
      }

      await service.handleWebhookEvent(event);
      res.json({ received: true });
    } catch (err) {
      next(err);
    }
  };
}
