import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type Stripe from 'stripe';
import type * as schema from '../../db/schema/index.js';
import { plans } from '../../db/schema/index.js';
import { stripeClient } from '../../lib/stripe.js';
import { badRequest, notFound } from '../../lib/errors.js';

export type BillingType = 'monthly' | 'yearly' | 'one_time' | 'manual';

export type CreatePlanInput = {
  name: string;
  billingType: BillingType;
  priceCents: number;
  currency?: string;
  maxGestores?: number | null;
  maxCreators?: number | null;
  syncStripe?: boolean;
  stripeImportPriceId?: string;
};

export type UpdatePlanInput = {
  name?: string;
  priceCents?: number;
  maxGestores?: number | null;
  maxCreators?: number | null;
  stripeImportPriceId?: string;
};

export function createPlatformPlansService(db: NodePgDatabase<typeof schema>, stripe: Stripe | null = stripeClient) {
  function requireStripe(): Stripe {
    if (!stripe) throw badRequest('STRIPE_NOT_CONFIGURED', 'Stripe não está configurado neste ambiente.');
    return stripe;
  }

  async function previewStripePrice(priceId: string) {
    const s = requireStripe();
    const price = await s.prices.retrieve(priceId, { expand: ['product'] });
    const product = price.product as Stripe.Product;

    let billingType: BillingType;
    if (price.type === 'one_time') {
      billingType = 'one_time';
    } else if (price.recurring?.interval === 'month') {
      billingType = 'monthly';
    } else if (price.recurring?.interval === 'year') {
      billingType = 'yearly';
    } else {
      billingType = 'manual';
    }

    return {
      price_id: price.id,
      product_id: product.id,
      product_name: product.name,
      unit_amount: price.unit_amount ?? 0,
      currency: price.currency,
      billing_type: billingType,
      active: price.active && product.active,
    };
  }

  async function list() {
    return db.select().from(plans).orderBy(plans.createdAt);
  }

  async function getById(id: string) {
    const [plan] = await db.select().from(plans).where(eq(plans.id, id)).limit(1);
    if (!plan) throw notFound('PLAN_NOT_FOUND', 'Plano não encontrado.');
    return plan;
  }

  async function create(input: CreatePlanInput) {
    let stripeProductId: string | null = null;
    let stripePriceId: string | null = null;
    let priceCents = input.priceCents;
    let currency = input.currency ?? 'brl';
    let billingType = input.billingType;

    if (input.stripeImportPriceId) {
      const preview = await previewStripePrice(input.stripeImportPriceId);
      stripePriceId = preview.price_id;
      stripeProductId = preview.product_id;
      priceCents = preview.unit_amount;
      currency = preview.currency;
      billingType = preview.billing_type;
    } else if (input.syncStripe && input.billingType !== 'manual') {
      const s = requireStripe();
      const product = await s.products.create({ name: input.name });
      stripeProductId = product.id;

      const priceData: Stripe.PriceCreateParams = {
        product: product.id,
        unit_amount: priceCents,
        currency,
      };

      if (billingType === 'monthly') priceData.recurring = { interval: 'month' };
      else if (billingType === 'yearly') priceData.recurring = { interval: 'year' };

      const price = await s.prices.create(priceData);
      stripePriceId = price.id;
    }

    const [plan] = await db
      .insert(plans)
      .values({ name: input.name, billingType, priceCents, currency, maxGestores: input.maxGestores ?? null, maxCreators: input.maxCreators ?? null, stripeProductId, stripePriceId })
      .returning();

    return plan!;
  }

  async function update(id: string, input: UpdatePlanInput) {
    const existing = await getById(id);
    const updates: Partial<typeof plans.$inferInsert> = {};

    if (input.name !== undefined) {
      updates.name = input.name;
      if (existing.stripeProductId && stripe) {
        await stripe.products.update(existing.stripeProductId, { name: input.name });
      }
    }

    if (input.maxGestores !== undefined) updates.maxGestores = input.maxGestores;
    if (input.maxCreators !== undefined) updates.maxCreators = input.maxCreators;

    if (input.stripeImportPriceId) {
      const preview = await previewStripePrice(input.stripeImportPriceId);
      updates.stripePriceId = preview.price_id;
      updates.stripeProductId = preview.product_id;
      updates.priceCents = preview.unit_amount;
      updates.currency = preview.currency;
      updates.billingType = preview.billing_type;
      if (existing.stripePriceId && stripe && existing.stripePriceId !== preview.price_id) {
        try { await stripe.prices.update(existing.stripePriceId, { active: false }); } catch { /* preço já pode estar arquivado */ }
      }
    } else if (input.priceCents !== undefined && input.priceCents !== existing.priceCents) {
      updates.priceCents = input.priceCents;
      if (existing.stripeProductId && stripe) {
        const s = stripe;
        const newPriceData: Stripe.PriceCreateParams = {
          product: existing.stripeProductId,
          unit_amount: input.priceCents,
          currency: existing.currency,
        };
        if (existing.billingType === 'monthly') newPriceData.recurring = { interval: 'month' };
        if (existing.billingType === 'yearly') newPriceData.recurring = { interval: 'year' };
        const newPrice = await s.prices.create(newPriceData);
        if (existing.stripePriceId) await s.prices.update(existing.stripePriceId, { active: false });
        updates.stripePriceId = newPrice.id;
      }
    }

    if (Object.keys(updates).length === 0) return existing;
    const [updated] = await db.update(plans).set(updates).where(eq(plans.id, id)).returning();
    return updated!;
  }

  async function deletePlan(id: string) {
    const [deleted] = await db.delete(plans).where(eq(plans.id, id)).returning();
    if (!deleted) throw notFound('PLAN_NOT_FOUND', 'Plano não encontrado.');
    return { ok: true };
  }

  async function syncStripeById(id: string) {
    const plan = await getById(id);
    if (!plan.stripeProductId || !plan.stripePriceId) {
      throw badRequest('NO_STRIPE_IDS', 'Este plano não tem produto/preço no Stripe associado.');
    }
    const s = requireStripe();
    const [product, price] = await Promise.all([
      s.products.retrieve(plan.stripeProductId),
      s.prices.retrieve(plan.stripePriceId),
    ]);
    return { plan, stripe: { product, price } };
  }

  return { list, getById, create, update, deletePlan, syncStripeById, previewStripePrice };
}

export type PlatformPlansService = ReturnType<typeof createPlatformPlansService>;
