import Stripe from 'stripe';
import { env } from './env.js';

/**
 * Opcional de propósito (mesmo padrão de VAPID/push): sem chave configurada, o cliente é `null` e
 * os services que dependem dele recusam a ação com um erro claro (BILLING_NOT_CONFIGURED) em vez
 * de quebrar o boot do servidor — o resto do app funciona normal sem cobrança configurada.
 */
export const stripeClient: Stripe | null = env.stripeSecretKey ? new Stripe(env.stripeSecretKey) : null;
