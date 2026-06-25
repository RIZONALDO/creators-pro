import bcrypt from 'bcryptjs';
import type Stripe from 'stripe';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createAuthService } from '../auth/auth.service.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createCompanyRepository } from '../company/company.repository.js';
import { createBillingService } from './billing.service.js';

/** Fake mínimo — só os métodos que o service de fato chama. */
function buildFakeStripe(overrides?: Partial<{ checkoutUrl: string; customerId: string; subscriptionId: string; currentPeriodEnd: number; invoices: Record<string, unknown>[] }>) {
  const checkoutCreate = vi.fn().mockResolvedValue({
    url: overrides?.checkoutUrl ?? 'https://checkout.stripe.com/fake-session',
    customer: overrides?.customerId ?? 'cus_fake',
    subscription: overrides?.subscriptionId ?? 'sub_fake',
  });
  const portalCreate = vi.fn().mockResolvedValue({ url: 'https://billing.stripe.com/fake-portal' });
  const subscriptionsRetrieve = vi.fn().mockResolvedValue({
    items: { data: [{ current_period_end: overrides?.currentPeriodEnd ?? Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60 }] },
  });
  const invoicesList = vi.fn().mockResolvedValue({ data: overrides?.invoices ?? [] });

  const stripe = {
    checkout: { sessions: { create: checkoutCreate } },
    billingPortal: { sessions: { create: portalCreate } },
    subscriptions: { retrieve: subscriptionsRetrieve },
    invoices: { list: invoicesList },
  } as unknown as Stripe;

  return { stripe, checkoutCreate, portalCreate, subscriptionsRetrieve, invoicesList };
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

  it('startTrial delega pro authService.startTrial (sem tocar no Stripe)', async () => {
    const { stripe, checkoutCreate } = buildFakeStripe();
    const service = createBillingService(testDb, authService, stripe, 'price_123');

    const result = await service.startTrial({ company_name: 'Trial Billing', admin_name: 'Admin', admin_email: 'admin@trialbilling.com', admin_password: 'senha12345' });

    expect(result.user.email).toBe('admin@trialbilling.com');
    expect(checkoutCreate).not.toHaveBeenCalled();
    expect(await companiesRepo.findBySlug('trial-billing')).toMatchObject({ status: 'trial' });
  });

  it('upgradeTrial recusa credenciais inválidas', async () => {
    await authService.startTrial({ companyName: 'Trial Senha', adminName: 'Admin', adminEmail: 'senha@trial.com', adminPassword: 'senha-correta' });
    const service = createBillingService(testDb, authService, buildFakeStripe().stripe, 'price_123');

    await expect(service.upgradeTrial({ email: 'senha@trial.com', password: 'senha-errada' })).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });
  });

  it('upgradeTrial recusa empresa que já está ativa (nada pra reativar)', async () => {
    const company = await companiesRepo.create({ name: 'Já Ativa', slug: 'ja-ativa' });
    const passwordHash = await bcrypt.hash('senha12345', 4);
    await usersRepo.create({ tenantId: company.id, name: 'Admin', email: 'admin@ja-ativa.com', passwordHash, role: 'admin' });

    const service = createBillingService(testDb, authService, buildFakeStripe().stripe, 'price_123');
    await expect(service.upgradeTrial({ email: 'admin@ja-ativa.com', password: 'senha12345' })).rejects.toMatchObject({ status: 400, code: 'NOTHING_TO_REACTIVATE' });
  });

  it('upgradeTrial também funciona pra reativar empresa suspensa/cancelada (não só trial)', async () => {
    const passwordHash = await bcrypt.hash('senha12345', 4);
    for (const status of ['suspended', 'cancelled'] as const) {
      const company = await companiesRepo.create({ name: `Empresa ${status}`, slug: `empresa-${status}` });
      await companiesRepo.updateStatus(company.id, status);
      await usersRepo.create({ tenantId: company.id, name: 'Admin', email: `admin@${status}.com`, passwordHash, role: 'admin' });

      const { stripe, checkoutCreate } = buildFakeStripe({ checkoutUrl: `https://checkout.stripe.com/${status}` });
      const service = createBillingService(testDb, authService, stripe, 'price_123');

      const result = await service.upgradeTrial({ email: `admin@${status}.com`, password: 'senha12345' });
      expect(result.checkout_url).toBe(`https://checkout.stripe.com/${status}`);
      expect(checkoutCreate).toHaveBeenCalledWith(expect.objectContaining({ metadata: { upgrade_company_id: company.id } }));
    }
  });

  it('upgradeTrial abre checkout com metadata upgrade_company_id (não cria empresa nova)', async () => {
    const { user } = await authService.startTrial({ companyName: 'Trial Upgrade', adminName: 'Admin', adminEmail: 'admin@trialupgrade.com', adminPassword: 'senha12345' });
    const { stripe, checkoutCreate } = buildFakeStripe({ checkoutUrl: 'https://checkout.stripe.com/upgrade' });
    const service = createBillingService(testDb, authService, stripe, 'price_123');

    const result = await service.upgradeTrial({ email: 'admin@trialupgrade.com', password: 'senha12345' });

    expect(result.checkout_url).toBe('https://checkout.stripe.com/upgrade');
    expect(checkoutCreate).toHaveBeenCalledWith(expect.objectContaining({ metadata: { upgrade_company_id: user.tenantId } }));
  });

  it('webhook checkout.session.completed com upgrade_company_id ativa a MESMA empresa (mantém os dados)', async () => {
    const { user } = await authService.startTrial({ companyName: 'Trial Webhook', adminName: 'Admin', adminEmail: 'admin@trialwebhook.com', adminPassword: 'senha12345' });
    const service = createBillingService(testDb, authService, buildFakeStripe().stripe, 'price_123');

    const adminIdBefore = (await usersRepo.findByEmail('admin@trialwebhook.com'))!.id;

    const event = buildCheckoutCompletedEvent({ upgrade_company_id: user.tenantId }, 'cus_trial_up', 'sub_trial_up');
    await service.handleWebhookEvent(event);

    const company = await companiesRepo.findById(user.tenantId);
    expect(company).toMatchObject({ status: 'active', stripeCustomerId: 'cus_trial_up', stripeSubscriptionId: 'sub_trial_up' });

    // mesmo admin de antes — não duplicou nem criou outro usuário/empresa.
    const adminAfter = await usersRepo.findByEmail('admin@trialwebhook.com');
    expect(adminAfter!.id).toBe(adminIdBefore);
  });

  it('getRenewalDate devolve null quando a empresa não tem assinatura Stripe', async () => {
    const company = await companiesRepo.create({ name: 'Sem Assinatura', slug: 'sem-assinatura' });
    const admin = await usersRepo.create({ tenantId: company.id, name: 'Admin', email: 'admin@semassinatura.com', passwordHash: 'hash', role: 'admin' });
    const service = createBillingService(testDb, authService, buildFakeStripe().stripe, 'price_123');

    const result = await service.getRenewalDate({ tenantId: company.id, userId: admin.id, role: 'admin' });
    expect(result.renews_at).toBeNull();
  });

  it('getRenewalDate consulta a Stripe e devolve a data de renovação quando há assinatura', async () => {
    const company = await companiesRepo.create({ name: 'Com Assinatura', slug: 'com-assinatura' });
    await companiesRepo.setStripeIds(company.id, { stripeCustomerId: 'cus_renew', stripeSubscriptionId: 'sub_renew' });
    const admin = await usersRepo.create({ tenantId: company.id, name: 'Admin', email: 'admin@comassinatura.com', passwordHash: 'hash', role: 'admin' });

    const periodEnd = Math.floor(Date.now() / 1000) + 15 * 24 * 60 * 60;
    const { stripe, subscriptionsRetrieve } = buildFakeStripe({ currentPeriodEnd: periodEnd });
    const service = createBillingService(testDb, authService, stripe, 'price_123');

    const result = await service.getRenewalDate({ tenantId: company.id, userId: admin.id, role: 'admin' });
    expect(subscriptionsRetrieve).toHaveBeenCalledWith('sub_renew');
    expect(result.renews_at).toBe(new Date(periodEnd * 1000).toISOString());
  });

  it('listInvoices devolve lista vazia quando a empresa não tem conta de cobrança', async () => {
    const company = await companiesRepo.create({ name: 'Sem Fatura', slug: 'sem-fatura' });
    const admin = await usersRepo.create({ tenantId: company.id, name: 'Admin', email: 'admin@semfatura.com', passwordHash: 'hash', role: 'admin' });
    const service = createBillingService(testDb, authService, buildFakeStripe().stripe, 'price_123');

    const result = await service.listInvoices({ tenantId: company.id, userId: admin.id, role: 'admin' });
    expect(result.invoices).toEqual([]);
  });

  it('listInvoices consulta a Stripe e devolve o histórico formatado', async () => {
    const company = await companiesRepo.create({ name: 'Com Fatura', slug: 'com-fatura' });
    await companiesRepo.setStripeIds(company.id, { stripeCustomerId: 'cus_inv', stripeSubscriptionId: 'sub_inv' });
    const admin = await usersRepo.create({ tenantId: company.id, name: 'Admin', email: 'admin@comfatura.com', passwordHash: 'hash', role: 'admin' });

    const createdAt = Math.floor(Date.now() / 1000) - 86400;
    const { stripe, invoicesList } = buildFakeStripe({
      invoices: [{
        id: 'in_123', number: 'INV-0001', status: 'paid', amount_paid: 19990, currency: 'brl',
        created: createdAt, hosted_invoice_url: 'https://invoice.stripe.com/i/in_123', invoice_pdf: 'https://invoice.stripe.com/i/in_123.pdf',
      }],
    });
    const service = createBillingService(testDb, authService, stripe, 'price_123');

    const result = await service.listInvoices({ tenantId: company.id, userId: admin.id, role: 'admin' });
    expect(invoicesList).toHaveBeenCalledWith({ customer: 'cus_inv', limit: 24 });
    expect(result.invoices).toEqual([{
      id: 'in_123', number: 'INV-0001', status: 'paid', amount_paid: 19990, currency: 'brl',
      created_at: new Date(createdAt * 1000).toISOString(),
      hosted_invoice_url: 'https://invoice.stripe.com/i/in_123', invoice_pdf: 'https://invoice.stripe.com/i/in_123.pdf',
    }]);
  });
});
