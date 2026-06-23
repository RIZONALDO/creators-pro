import bcrypt from 'bcryptjs';
import Stripe from 'stripe';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';

const WEBHOOK_SECRET = 'whsec_test_fake_secret';

function buildFakeStripeClient(overrides?: { checkoutUrl?: string; customer?: string; subscription?: string }) {
  return {
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({
          url: overrides?.checkoutUrl ?? 'https://checkout.stripe.com/fake',
          customer: overrides?.customer ?? 'cus_fake',
          subscription: overrides?.subscription ?? 'sub_fake',
        }),
      },
    },
    billingPortal: {
      sessions: { create: vi.fn().mockResolvedValue({ url: 'https://billing.stripe.com/fake-portal' }) },
    },
    webhooks: Stripe.webhooks,
  } as unknown as Stripe;
}

function signedWebhookBody(payloadObj: unknown) {
  const payload = JSON.stringify(payloadObj);
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  return { payload, signature };
}

describe('rotas de billing (integração)', () => {
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  it('POST /signup sem stripe configurado devolve BILLING_NOT_CONFIGURED', async () => {
    const app = createApp(testDb); // sem billingDeps -> usa env real (sem chave no .env.test)
    const res = await request(app).post('/signup').send({ company_name: 'Acme', admin_name: 'Admin', admin_email: 'admin@acme.com', admin_password: 'senha1234' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BILLING_NOT_CONFIGURED');
  });

  it('POST /signup valida o corpo (senha curta) antes de chamar o Stripe', async () => {
    const stripe = buildFakeStripeClient();
    const app = createApp(testDb, undefined, undefined, { stripe, priceId: 'price_123' });
    const res = await request(app).post('/signup').send({ company_name: 'Acme', admin_name: 'Admin', admin_email: 'admin@acme.com', admin_password: '123' });
    expect(res.status).toBe(400);
  });

  it('POST /signup feliz: devolve checkout_url e não cria nada no banco ainda', async () => {
    const stripe = buildFakeStripeClient({ checkoutUrl: 'https://checkout.stripe.com/abc123' });
    const app = createApp(testDb, undefined, undefined, { stripe, priceId: 'price_123' });

    const res = await request(app).post('/signup').send({ company_name: 'Nova Empresa', admin_name: 'Fulano', admin_email: 'fulano@nova.com', admin_password: 'senha1234' });
    expect(res.status).toBe(201);
    expect(res.body.data.checkout_url).toBe('https://checkout.stripe.com/abc123');
    expect(await usersRepo.findByEmail('fulano@nova.com')).toBeNull();
  });

  it('POST /billing/webhook com assinatura válida cria a empresa (checkout.session.completed)', async () => {
    const app = createApp(testDb, undefined, undefined, { stripe: buildFakeStripeClient(), priceId: 'price_123', webhookSecret: WEBHOOK_SECRET });

    const { payload, signature } = signedWebhookBody({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: { object: { metadata: { company_name: 'Via Webhook', admin_name: 'Fulano', admin_email: 'fulano@webhook.com', admin_password_hash: 'hash123' }, customer: 'cus_1', subscription: 'sub_1' } },
    });

    const res = await request(app).post('/billing/webhook').set('Content-Type', 'application/json').set('stripe-signature', signature).send(payload);
    expect(res.status).toBe(200);

    const company = await companiesRepo.findBySlug('via-webhook');
    expect(company).toMatchObject({ stripeCustomerId: 'cus_1', status: 'active' });
  });

  it('POST /billing/webhook com assinatura inválida devolve 400, sem criar nada', async () => {
    const app = createApp(testDb, undefined, undefined, { stripe: buildFakeStripeClient(), priceId: 'price_123', webhookSecret: WEBHOOK_SECRET });
    const payload = JSON.stringify({ id: 'evt_2', type: 'checkout.session.completed', data: { object: {} } });

    const res = await request(app).post('/billing/webhook').set('Content-Type', 'application/json').set('stripe-signature', 't=1,v1=assinatura-forjada').send(payload);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_SIGNATURE');
  });

  it('POST /billing/portal exige autenticação e papel admin', async () => {
    const app = createApp(testDb, undefined, undefined, { stripe: buildFakeStripeClient(), priceId: 'price_123', webhookSecret: WEBHOOK_SECRET });
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme-portal' });
    const passwordHash = await bcrypt.hash('senha123', 4);
    await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: 'gestora@acme-portal.com', passwordHash, role: 'gestor' });
    await companiesRepo.setStripeIds(company.id, { stripeCustomerId: 'cus_portal', stripeSubscriptionId: 'sub_portal' });

    const noAuth = await request(app).post('/billing/portal');
    expect(noAuth.status).toBe(401);

    const gestorLogin = await request(app).post('/auth/login').send({ email: 'gestora@acme-portal.com', password: 'senha123' });
    const asGestor = await request(app).post('/billing/portal').set('Authorization', `Bearer ${gestorLogin.body.token}`);
    expect(asGestor.status).toBe(403);
  });

  it('POST /billing/portal como admin devolve a portal_url', async () => {
    const app = createApp(testDb, undefined, undefined, { stripe: buildFakeStripeClient(), priceId: 'price_123', webhookSecret: WEBHOOK_SECRET });
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme-portal-2' });
    const passwordHash = await bcrypt.hash('senha123', 4);
    await usersRepo.create({ tenantId: company.id, name: 'Admin', email: 'admin@acme-portal-2.com', passwordHash, role: 'admin' });
    await companiesRepo.setStripeIds(company.id, { stripeCustomerId: 'cus_portal_2', stripeSubscriptionId: 'sub_portal_2' });

    const login = await request(app).post('/auth/login').send({ email: 'admin@acme-portal-2.com', password: 'senha123' });
    const res = await request(app).post('/billing/portal').set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.portal_url).toBe('https://billing.stripe.com/fake-portal');
  });

  it('GET /billing/status devolve status real da empresa e se tem assinatura ligada', async () => {
    const app = createApp(testDb, undefined, undefined, { stripe: buildFakeStripeClient(), priceId: 'price_123', webhookSecret: WEBHOOK_SECRET });
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme-status' });
    const passwordHash = await bcrypt.hash('senha123', 4);
    await usersRepo.create({ tenantId: company.id, name: 'Admin', email: 'admin@acme-status.com', passwordHash, role: 'admin' });
    await companiesRepo.setStripeIds(company.id, { stripeCustomerId: 'cus_status', stripeSubscriptionId: 'sub_status' });

    const login = await request(app).post('/auth/login').send({ email: 'admin@acme-status.com', password: 'senha123' });
    const res = await request(app).get('/billing/status').set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ status: 'active', has_subscription: true });
  });

  it('login é bloqueado com 402 SUBSCRIPTION_INACTIVE quando a empresa não está ativa', async () => {
    const app = createApp(testDb);
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme-suspensa' });
    const passwordHash = await bcrypt.hash('senha123', 4);
    await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: 'gestora@acme-suspensa.com', passwordHash, role: 'gestor' });
    await companiesRepo.updateStatus(company.id, 'suspended');

    const res = await request(app).post('/auth/login').send({ email: 'gestora@acme-suspensa.com', password: 'senha123' });
    expect(res.status).toBe(402);
    expect(res.body.error.code).toBe('SUBSCRIPTION_INACTIVE');
  });
});
