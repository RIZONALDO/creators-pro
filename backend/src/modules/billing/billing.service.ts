import bcrypt from 'bcryptjs';
import type Stripe from 'stripe';
import type { db as Db } from '../../db/client.js';
import type { AuthContext } from '../../middleware/authenticate.js';
import { badRequest, conflict, unauthorized } from '../../lib/errors.js';
import { stripeClient } from '../../lib/stripe.js';
import { env } from '../../lib/env.js';
import { slugify, uniqueSlug } from '../../lib/slug.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';
import type { AuthService } from '../auth/auth.service.js';
import type { signupSchema, upgradeTrialSchema } from './billing.schemas.js';
import type { z } from 'zod';

type SignupInput = z.infer<typeof signupSchema>;
type UpgradeTrialInput = z.infer<typeof upgradeTrialSchema>;

/**
 * `stripe`/`priceId` são injetáveis (mesmo padrão de emitter/pushSender) — o teste constrói o
 * service com um cliente Stripe falso (vi.fn()), sem depender de chave real configurada no .env.test.
 */
export function createBillingService(
  db: typeof Db,
  authService: AuthService,
  stripe: Stripe | null = stripeClient,
  priceId: string | undefined = env.stripePriceId,
) {
  const companiesRepo = createCompaniesRepository(db);
  const usersRepo = createUsersRepository(db);

  function requireStripe(): { stripe: Stripe; priceId: string } {
    if (!stripe || !priceId) {
      throw badRequest('BILLING_NOT_CONFIGURED', 'Cobrança ainda não configurada neste ambiente.');
    }
    return { stripe, priceId };
  }

  async function uniqueCompanySlug(base: string): Promise<string> {
    return uniqueSlug(base, async (slug) => !!(await companiesRepo.findBySlug(slug)));
  }

  return {
    /**
     * Não cria nada no banco ainda — só abre a sessão de Checkout, com os dados do cadastro
     * guardados em metadata. A empresa/admin só existem de fato depois do pagamento confirmar
     * (handleWebhookEvent), pra nunca sobrar tenant "fantasma" de quem começou e não pagou.
     */
    async startSignup(input: SignupInput) {
      const { stripe, priceId } = requireStripe();

      const existingUser = await usersRepo.findByEmail(input.admin_email);
      if (existingUser) throw conflict('EMAIL_TAKEN', 'Já existe uma conta com este e-mail.');

      const passwordHash = await bcrypt.hash(input.admin_password, 10);

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        customer_email: input.admin_email,
        success_url: `${env.appUrl}/cadastro/sucesso`,
        cancel_url: `${env.appUrl}/cadastro`,
        metadata: {
          company_name: input.company_name,
          admin_name: input.admin_name,
          admin_email: input.admin_email,
          admin_password_hash: passwordHash,
        },
      });

      if (!session.url) throw badRequest('CHECKOUT_SESSION_ERROR', 'Não foi possível iniciar o checkout.');
      return { checkout_url: session.url };
    },

    /** Webhook Stripe — único lugar que de fato cria empresa/admin (pagamento), ativa um trial que
     * decidiu assinar (upgradeTrial), ou suspende (cancelamento/falha). */
    async handleWebhookEvent(event: Stripe.Event) {
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const meta = session.metadata;

        // Upgrade de trial: empresa já existe (com os dados que a pessoa cadastrou nas 4h de
        // teste) — só ativa e liga a assinatura, nunca cria nada novo (senão perderia tudo que
        // ela já tinha configurado).
        if (meta?.upgrade_company_id) {
          await companiesRepo.updateStatus(meta.upgrade_company_id, 'active');
          await companiesRepo.setStripeIds(meta.upgrade_company_id, {
            stripeCustomerId: String(session.customer),
            stripeSubscriptionId: session.subscription ? String(session.subscription) : null,
          });
          return;
        }

        // sessão sem esses campos não é um signup nosso (ex.: checkout criado por outro fluxo) — ignora.
        if (!meta?.company_name || !meta.admin_name || !meta.admin_email || !meta.admin_password_hash) return;

        const slug = await uniqueCompanySlug(slugify(meta.company_name));
        const { company } = await authService.provisionCompanyFromHash({
          name: meta.company_name,
          slug,
          adminName: meta.admin_name,
          adminEmail: meta.admin_email,
          passwordHash: meta.admin_password_hash,
        });

        await companiesRepo.setStripeIds(company.id, {
          stripeCustomerId: String(session.customer),
          stripeSubscriptionId: session.subscription ? String(session.subscription) : null,
        });
        return;
      }

      if (event.type === 'customer.subscription.deleted' || event.type === 'invoice.payment_failed') {
        const obj = event.data.object as { customer: string | Stripe.Customer | Stripe.DeletedCustomer };
        const customerId = typeof obj.customer === 'string' ? obj.customer : obj.customer.id;
        const company = await companiesRepo.findByStripeCustomerId(customerId);
        if (company) await companiesRepo.updateStatus(company.id, 'suspended');
        return;
      }

      if (event.type === 'customer.subscription.updated') {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
        const company = await companiesRepo.findByStripeCustomerId(customerId);
        if (!company) return;
        // 'active'/'trialing' = volta a liberar (ex.: pagamento atrasado foi resolvido); resto = suspende.
        const reactivated = subscription.status === 'active' || subscription.status === 'trialing';
        await companiesRepo.updateStatus(company.id, reactivated ? 'active' : 'suspended');
      }
    },

    /** Admin já logado gerenciando a própria cobrança (seção Cobrança) — Stripe Customer Portal, página hospedada por eles. */
    async createPortalSession(auth: AuthContext) {
      const { stripe } = requireStripe();
      const company = await companiesRepo.findById(auth.tenantId);
      if (!company?.stripeCustomerId) throw badRequest('NO_BILLING_ACCOUNT', 'Esta empresa não tem conta de cobrança vinculada.');

      const portal = await stripe.billingPortal.sessions.create({
        customer: company.stripeCustomerId,
        return_url: `${env.appUrl}/admin/cobranca`,
      });
      return { portal_url: portal.url };
    },

    /** Status real (não inventado) pra seção de Cobrança — status vem do próprio webhook da Stripe (ver handleWebhookEvent). */
    async getStatus(auth: AuthContext) {
      const company = await companiesRepo.findById(auth.tenantId);
      if (!company) throw badRequest('COMPANY_NOT_FOUND', 'Empresa não encontrada.');
      return { status: company.status, has_subscription: !!company.stripeSubscriptionId, trial_ends_at: company.trialEndsAt };
    },

    /** Data de renovação (Pro) — só usada pela tela Conta (contagem regressiva), nunca pelo
     * sidebar (que chama getStatus() acima a cada render, sem ir até a Stripe). Consulta a Stripe
     * de verdade aqui de propósito — período de cobrança não é salvo no nosso banco, e mudar isso
     * só pra cachear essa data seria mais complexidade do que o uso (uma tela, pouco acessada)
     * justifica. */
    async getRenewalDate(auth: AuthContext) {
      const company = await companiesRepo.findById(auth.tenantId);
      if (!stripe || !company?.stripeSubscriptionId) return { renews_at: null };

      const subscription = await stripe.subscriptions.retrieve(company.stripeSubscriptionId);
      const periodEnd = subscription.items.data[0]?.current_period_end;
      return { renews_at: periodEnd ? new Date(periodEnd * 1000).toISOString() : null };
    },

    /** Teste de 4h sem cartão — não passa pela Stripe (decisão deliberada: cobrança automática
     * numa janela tão curta é risco de disputa/reputação numa marca nova; ver upgradeTrial pro
     * caminho de quem decide continuar). Delega pro auth.service.ts, que já sabe criar
     * empresa+admin+sessão (mesmo núcleo do provisionamento manual). */
    async startTrial(input: SignupInput) {
      return authService.startTrial({
        companyName: input.company_name,
        adminName: input.admin_name,
        adminEmail: input.admin_email,
        adminPassword: input.admin_password,
      });
    },

    /**
     * Quem decide assinar (trial ainda válido ou já vencido) confirma a própria senha de novo —
     * não tem sessão pra reaproveitar aqui de propósito: se o trial já venceu, o login está
     * bloqueado (ver auth.service.ts#login), então pedir e-mail+senha de novo é o único jeito de
     * provar identidade sem precisar reativar o acesso primeiro. Mantém a MESMA empresa (e os
     * dados que já tinha) — nunca cria uma nova.
     */
    async upgradeTrial(input: UpgradeTrialInput) {
      const { stripe, priceId } = requireStripe();

      const user = await usersRepo.findByEmail(input.email);
      if (!user || user.role !== 'admin' || !user.passwordHash) {
        throw unauthorized('INVALID_CREDENTIALS', 'E-mail ou senha inválidos.');
      }
      const passwordOk = await bcrypt.compare(input.password, user.passwordHash);
      if (!passwordOk) throw unauthorized('INVALID_CREDENTIALS', 'E-mail ou senha inválidos.');

      const company = await companiesRepo.findById(user.tenantId);
      if (!company || company.status !== 'trial') {
        throw badRequest('NOT_A_TRIAL', 'Esta conta não está em período de teste.');
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        customer_email: user.email,
        success_url: `${env.appUrl}/login`,
        cancel_url: `${env.appUrl}/login`,
        metadata: { upgrade_company_id: company.id },
      });

      if (!session.url) throw badRequest('CHECKOUT_SESSION_ERROR', 'Não foi possível iniciar o checkout.');
      return { checkout_url: session.url };
    },
  };
}

export type BillingService = ReturnType<typeof createBillingService>;
