import type Stripe from 'stripe';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createAuthService } from '../auth/auth.service.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createCompanyRepository } from '../company/company.repository.js';
import { createBillingService } from './billing.service.js';

/** Fake mínimo — só os 3 métodos que o service de fato chama. */
function buildFakeStripe(overrides?: Partial<{ checkoutUrl: string; customerId: string; subscriptionId: string }>) {
  const checkoutCreate = vi.fn().mockResolvedValue({
    url: overrides?.checkoutUrl ?? 'https://checkout.stripe.com/fake-session',
    customer: overrides?.customerId ?? 'cus_fake',
    subscription: overrides?.subscriptionId ?? 'sub_fake',
  });
  const portalCreate = vi.fn().mockResolvedValue({ url: 'https://billing.stripe.com/fake-portal' });

  const stripe = {
    checkout: { sessions: { create: checkoutCreate } },
    billingPortal: { sessions: { create: portalCreate } },
  } as unknown as Stripe;

  return { stripe, checkoutCreate, portalCreate };
}

function buildCheckoutCompletedEvent(metadata: Record<string, string>, customer = 'cus_fake', subscription: string | null = 'sub_fake'): Stripe.Event {
  return {
    type: 'checkout.session.completed',
    data: { object: { metadata, customer, subscription } },
  } as unknown as Stripe.Event;
}

describe('billingService', () => {
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);
  const companySettingsRepo = createCompanyRepository(testDb);
  const authService = createAuthService(testDb);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  it('startSignup recusa com BILLING_NOT_CONFIGURED quando não há stripe/priceId', async () => {
    const service = createBillingService(testDb, authService, null, undefined);
    await expect(
      service.startSignup({ company_name: 'Acme', admin_name: 'Admin', admin_email: 'admin@acme.com', admin_password: 'senha1234' }),
    ).rejects.toMatchObject({ status: 400, code: 'BILLING_NOT_CONFIGURED' });
  });

  it('startSignup recusa e-mail já usado, sem nem chamar o Stripe', async () => {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    await usersRepo.create({ tenantId: company.id, name: 'Já existe', email: 'ja-existe@acme.com', passwordHash: 'hash', role: 'gestor' });

    const { stripe, checkoutCreate } = buildFakeStripe();
    const service = createBillingService(testDb, authService, stripe, 'price_123');

    await expect(
      service.startSignup({ company_name: 'Acme', admin_name: 'Admin', admin_email: 'ja-existe@acme.com', admin_password: 'senha1234' }),
    ).rejects.toMatchObject({ status: 409, code: 'EMAIL_TAKEN' });
    expect(checkoutCreate).not.toHaveBeenCalled();
  });

  it('startSignup NÃO cria empresa/usuário ainda — só abre a sessão de checkout', async () => {
    const { stripe } = buildFakeStripe({ checkoutUrl: 'https://checkout.stripe.com/abc' });
    const service = createBillingService(testDb, authService, stripe, 'price_123');

    const result = await service.startSignup({ company_name: 'Nova Empresa', admin_name: 'Fulano', admin_email: 'fulano@nova.com', admin_password: 'senha1234' });
    expect(result.checkout_url).toBe('https://checkout.stripe.com/abc');

    expect(await companiesRepo.findBySlug('nova-empresa')).toBeNull();
    expect(await usersRepo.findByEmail('fulano@nova.com')).toBeNull();
  });

  it('webhook checkout.session.completed cria empresa+admin e liga o stripe_customer_id', async () => {
    const service = createBillingService(testDb, authService, buildFakeStripe().stripe, 'price_123');

    const event = buildCheckoutCompletedEvent({
      company_name: 'Nova Empresa',
      admin_name: 'Fulano',
      admin_email: 'fulano@nova.com',
      admin_password_hash: 'hash-ja-pronto',
    }, 'cus_123', 'sub_123');

    await service.handleWebhookEvent(event);

    const company = await companiesRepo.findBySlug('nova-empresa');
    expect(company).toMatchObject({ name: 'Nova Empresa', status: 'active', stripeCustomerId: 'cus_123', stripeSubscriptionId: 'sub_123' });

    const admin = await usersRepo.findByEmail('fulano@nova.com');
    expect(admin).toMatchObject({ role: 'admin', passwordHash: 'hash-ja-pronto', tenantId: company!.id });

    // mesmo nome digitado no signup já cai em company_settings.display_name — admin não chega numa tela vazia.
    const settings = await companySettingsRepo.findByTenant(company!.id);
    expect(settings?.displayName).toBe('Nova Empresa');
  });

  it('webhook ignora checkout.session.completed sem metadata nossa (sessão de outro fluxo)', async () => {
    const service = createBillingService(testDb, authService, buildFakeStripe().stripe, 'price_123');
    await expect(service.handleWebhookEvent(buildCheckoutCompletedEvent({}))).resolves.toBeUndefined();
  });

  it('slug colide -> gera um novo (empresa-2) em vez de falhar', async () => {
    await companiesRepo.create({ name: 'Existente', slug: 'nova-empresa' });
    const service = createBillingService(testDb, authService, buildFakeStripe().stripe, 'price_123');

    const event = buildCheckoutCompletedEvent({
      company_name: 'Nova Empresa',
      admin_name: 'Fulano',
      admin_email: 'fulano2@nova.com',
      admin_password_hash: 'hash',
    });
    await service.handleWebhookEvent(event);

    expect(await companiesRepo.findBySlug('nova-empresa-2')).not.toBeNull();
  });

  it('webhook customer.subscription.deleted suspende a empresa correspondente', async () => {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme-sub' });
    await companiesRepo.setStripeIds(company.id, { stripeCustomerId: 'cus_777', stripeSubscriptionId: 'sub_777' });

    const service = createBillingService(testDb, authService, buildFakeStripe().stripe, 'price_123');
    await service.handleWebhookEvent({ type: 'customer.subscription.deleted', data: { object: { customer: 'cus_777' } } } as unknown as Stripe.Event);

    expect(await companiesRepo.findById(company.id)).toMatchObject({ status: 'suspended' });
  });

  it('webhook customer.subscription.updated reativa quando status volta a active', async () => {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme-sub2' });
    await companiesRepo.setStripeIds(company.id, { stripeCustomerId: 'cus_888', stripeSubscriptionId: 'sub_888' });
    await companiesRepo.updateStatus(company.id, 'suspended');

    const service = createBillingService(testDb, authService, buildFakeStripe().stripe, 'price_123');
    await service.handleWebhookEvent({
      type: 'customer.subscription.updated',
      data: { object: { customer: 'cus_888', status: 'active' } },
    } as unknown as Stripe.Event);

    expect(await companiesRepo.findById(company.id)).toMatchObject({ status: 'active' });
  });

  it('createPortalSession recusa quando a empresa não tem stripe_customer_id', async () => {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme-sem-billing' });
    const admin = await usersRepo.create({ tenantId: company.id, name: 'Admin', email: 'admin@acme-sem-billing.com', passwordHash: 'hash', role: 'admin' });
    const service = createBillingService(testDb, authService, buildFakeStripe().stripe, 'price_123');

    await expect(
      service.createPortalSession({ tenantId: company.id, userId: admin.id, role: 'admin' }),
    ).rejects.toMatchObject({ status: 400, code: 'NO_BILLING_ACCOUNT' });
  });

  it('createPortalSession devolve a URL do portal quando a empresa tem billing configurado', async () => {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme-com-billing' });
    await companiesRepo.setStripeIds(company.id, { stripeCustomerId: 'cus_999', stripeSubscriptionId: 'sub_999' });
    const admin = await usersRepo.create({ tenantId: company.id, name: 'Admin', email: 'admin@acme-com-billing.com', passwordHash: 'hash', role: 'admin' });

    const { stripe, portalCreate } = buildFakeStripe();
    const service = createBillingService(testDb, authService, stripe, 'price_123');

    const result = await service.createPortalSession({ tenantId: company.id, userId: admin.id, role: 'admin' });
    expect(result.portal_url).toBe('https://billing.stripe.com/fake-portal');
    expect(portalCreate).toHaveBeenCalledWith(expect.objectContaining({ customer: 'cus_999' }));
  });
});
