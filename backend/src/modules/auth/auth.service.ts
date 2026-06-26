import bcrypt from 'bcryptjs';
import type { db as Db } from '../../db/client.js';
import { emailSender as defaultEmailSender, type EmailSender } from '../../lib/email.js';
import { env } from '../../lib/env.js';
import { ApiError, conflict, paymentRequired, unauthorized } from '../../lib/errors.js';
import { verifyGoogleIdToken as defaultVerifyGoogleIdToken, type GoogleProfile } from '../../lib/googleAuth.js';
import { signAccessToken } from '../../lib/jwt.js';
import { sanitizeUser } from '../../lib/sanitizeUser.js';
import { slugify, uniqueSlug } from '../../lib/slug.js';
import { generateOpaqueToken, hashToken } from '../../lib/tokens.js';
import { logger } from '../../lib/logger.js';
import type { CompanyStatus } from '../../db/schema/index.js';
import { createCreatorsRepository } from '../creators/creators.repository.js';
import { createCollaboratorsRepository } from '../collaborators/collaborators.repository.js';
import { createCompanyRepository } from '../company/company.repository.js';
import { createCompaniesRepository } from './companies.repository.js';
import { createRefreshTokensRepository } from './refreshTokens.repository.js';
import { createUsersRepository, type CreateUserInput, type LinkGoogleProfileInput } from './users.repository.js';

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias
const TRIAL_DURATION_MS = 4 * 60 * 60 * 1000; // 4 horas
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hora

/** verifyGoogleIdToken/emailSender injetáveis (mesmo padrão de stripe em billing.service.ts) — o
 * teste injeta fakes em vez de chamar o Google/Resend de verdade. */
export function createAuthService(
  db: typeof Db,
  verifyGoogleIdToken: (idToken: string) => Promise<GoogleProfile> = defaultVerifyGoogleIdToken,
  emailSender: EmailSender = defaultEmailSender,
) {
  const usersRepo = createUsersRepository(db);
  const refreshTokensRepo = createRefreshTokensRepository(db);
  const companiesRepo = createCompaniesRepository(db);
  const companySettingsRepo = createCompanyRepository(db);
  const creatorsRepo = createCreatorsRepository(db);
  const collaboratorsRepo = createCollaboratorsRepository(db);

  /** Mesmo enriquecimento usado por login() e me() — o frontend precisa disso nos dois casos pra
   * saber "quem" essa conta operacional é (Creator vs Colaborador) e qual a profissão real
   * cadastrada, em vez de cravar um rótulo genérico de role no front (specs/06 — alias/função). */
  async function buildUserResponse(user: NonNullable<Awaited<ReturnType<typeof usersRepo.findById>>>) {
    const [creator, collaborator] = await Promise.all([
      creatorsRepo.findRowByUserId(user.tenantId, user.id),
      collaboratorsRepo.findRowByUserId(user.tenantId, user.id),
    ]);
    return {
      ...sanitizeUser(user),
      creator_id: creator?.id ?? null,
      collaborator_id: collaborator?.id ?? null,
      profession: collaborator?.profession ?? null,
    };
  }

  /** Checagem compartilhada por login/loginWithGoogle/claimInviteWithGoogle/refresh — única fonte
   * de verdade pra "essa empresa pode usar o sistema agora". 'trial' só passa enquanto
   * trial_ends_at não chegou; depois disso é bloqueada com um motivo (TRIAL_EXPIRED) diferente de
   * suspensão por pagamento, já que não existe assinatura Stripe nenhuma nesse estado pra avisar
   * o cliente por e-mail — o aviso só pode vir daqui. Sem essa checagem em refresh() também, uma
   * sessão aberta antes do trial vencer renovaria o access token pra sempre via refresh_token (30
   * dias), nunca sendo de fato bloqueada — o mesmo já valeria pra empresa suspensa por pagamento. */
  function assertCompanyUsable(company: { status: CompanyStatus; trialEndsAt: Date | null } | null) {
    if (!company) throw paymentRequired('SUBSCRIPTION_INACTIVE', 'Assinatura suspensa ou cancelada. Atualize o pagamento para continuar.');
    if (company.status === 'trial') {
      if (!company.trialEndsAt || company.trialEndsAt.getTime() < Date.now()) {
        throw paymentRequired('TRIAL_EXPIRED', 'Seu teste grátis de 4 horas acabou. Assine para continuar usando.');
      }
      return;
    }
    if (company.status !== 'active') {
      throw paymentRequired('SUBSCRIPTION_INACTIVE', 'Assinatura suspensa ou cancelada. Atualize o pagamento para continuar.');
    }
  }

  async function issueSession(user: { id: string; tenantId: string; role: 'admin' | 'gestor' | 'operacional' }, userAgent?: string) {
    const token = signAccessToken({ sub: user.id, tenant_id: user.tenantId, role: user.role });

    const refreshToken = generateOpaqueToken();
    await refreshTokensRepo.create({
      tenantId: user.tenantId,
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      userAgent,
    });

    return { token, refreshToken };
  }

  /** Núcleo compartilhado por provisionCompany() (senha em texto puro, /internal/companies),
   * provisionCompanyFromHash() (hash já pronto, vindo do webhook de pagamento — Fase 9.1) e
   * startTrial() (status/trialEndsAt — sem isso, status sai 'active' por padrão). */
  async function createCompanyAndAdmin(input: { name: string; slug: string; adminName: string; adminEmail: string; passwordHash: string; status?: CompanyStatus; trialEndsAt?: Date | null }) {
    const existing = await companiesRepo.findBySlug(input.slug);
    if (existing) throw conflict('SLUG_TAKEN', 'Já existe uma empresa com este slug.');

    const company = await companiesRepo.create({ name: input.name, slug: input.slug, status: input.status, trialEndsAt: input.trialEndsAt });
    // sem isso, company_settings.display_name nasce vazio e o admin via "Configurações da empresa"
    // sem nada — apesar de já ter digitado o nome da empresa no signup, só que noutra tabela.
    await companySettingsRepo.upsert(company.id, { displayName: input.name });
    const admin = await usersRepo.create({
      tenantId: company.id,
      name: input.adminName,
      email: input.adminEmail,
      passwordHash: input.passwordHash,
      role: 'admin',
    } satisfies CreateUserInput);

    return { company, admin: sanitizeUser(admin) };
  }

  return {
    async login(email: string, password: string, userAgent?: string) {
      const user = await usersRepo.findByEmail(email);
      if (!user || user.status !== 'active') {
        throw unauthorized('INVALID_CREDENTIALS', 'E-mail ou senha inválidos.');
      }

      // Conta 'pending' (convite só com e-mail) ou criada sem senha por algum outro motivo — nunca
      // chega a bcrypt.compare contra null. Mesma mensagem genérica de senha errada (não dá pra
      // distinguir "conta sem senha" de "senha errada" sem vazar info sobre como a conta foi criada).
      const passwordOk = user.passwordHash ? await bcrypt.compare(password, user.passwordHash) : false;
      if (!passwordOk) {
        throw unauthorized('INVALID_CREDENTIALS', 'E-mail ou senha inválidos.');
      }

      // Fase 9.1: credenciais corretas, mas a empresa não pode usar o sistema agora (suspensa,
      // cancelada, ou trial vencido) — 402, não 401, pra não confundir com "senha errada" no frontend.
      const company = await companiesRepo.findById(user.tenantId);
      assertCompanyUsable(company);

      const session = await issueSession(user, userAgent);
      return { ...session, user: await buildUserResponse(user) };
    },

    /** Login alternativo via Google pra quem já tem conta ativa: nunca cria conta nova, e nunca
     * ativa uma conta 'pending' (isso só acontece via claimInviteWithGoogle, com o token de
     * convite — ver abaixo "por quê"). Conta já 'active' só ganha google_id como credencial
     * extra, sem tocar no nome já cadastrado. */
    async loginWithGoogle(idToken: string, userAgent?: string) {
      const profile = await verifyGoogleIdToken(idToken);
      if (!profile.emailVerified) {
        throw unauthorized('GOOGLE_EMAIL_NOT_VERIFIED', 'O e-mail da sua conta Google não está verificado.');
      }

      const user = await usersRepo.findByEmail(profile.email);
      if (!user || user.status === 'inactive') {
        throw unauthorized('ACCOUNT_NOT_FOUND', 'Nenhuma conta encontrada para este e-mail. Peça para seu gestor cadastrar você antes.');
      }
      // Por quê: sem o token de convite, bastava alguém digitar seu e-mail (real, mas sem nenhuma
      // relação com você) num cadastro de Creator/Colaborador/Gestor em QUALQUER tenant da
      // plataforma pra "plantar" uma conta — e, como o e-mail é único globalmente (não por
      // tenant), o primeiro "Continuar com o Google" seu em QUALQUER login da plataforma
      // reivindicaria essa conta plantada, te colocando dentro do tenant de quem a criou, no papel
      // que essa pessoa escolheu. Exigir o token (só entregue pelo link de convite, fora desse
      // botão genérico) fecha esse buraco: ver claimInviteWithGoogle.
      if (user.status === 'pending') {
        throw unauthorized('ACCOUNT_PENDING_INVITE', 'Esta conta ainda não foi ativada. Use o link de convite enviado por quem te cadastrou.');
      }

      const company = await companiesRepo.findById(user.tenantId);
      assertCompanyUsable(company);

      const patch: LinkGoogleProfileInput = {};
      if (user.googleId !== profile.googleId) patch.googleId = profile.googleId;
      if (!user.avatarUrl && profile.picture) patch.avatarUrl = profile.picture;

      const finalUser = Object.keys(patch).length > 0 ? await usersRepo.linkGoogleProfile(user.id, patch) : user;

      const session = await issueSession(finalUser, userAgent);
      return { ...session, user: await buildUserResponse(finalUser) };
    },

    /** Único jeito de ativar uma conta 'pending' (convite só com e-mail, sem senha — ver
     * creators.service.ts/collaborators.service.ts#create). Exige o token de convite (entregue só
     * pelo link que o gestor compartilha por fora, nunca pelo botão de login comum) E que o e-mail
     * verificado pelo Google bata com o e-mail cadastrado — as duas coisas juntas, não uma ou
     * outra: o token sozinho não bastaria pra autorizar qualquer identidade Google, e o e-mail
     * sozinho é exatamente o buraco que esse fluxo existe pra fechar (ver loginWithGoogle). Token
     * é de uso único — invalidado (null) aqui, nunca mais reutilizável. */
    async claimInviteWithGoogle(token: string, idToken: string, userAgent?: string) {
      const tokenHash = hashToken(token);
      const user = await usersRepo.findByInviteTokenHash(tokenHash);
      if (!user || user.status !== 'pending') {
        throw unauthorized('INVALID_INVITE_TOKEN', 'Convite inválido, expirado ou já utilizado.');
      }

      const profile = await verifyGoogleIdToken(idToken);
      if (!profile.emailVerified) {
        throw unauthorized('GOOGLE_EMAIL_NOT_VERIFIED', 'O e-mail da sua conta Google não está verificado.');
      }
      if (profile.email !== user.email) {
        throw unauthorized('INVITE_EMAIL_MISMATCH', `Este convite é para ${user.email} — entre com essa conta Google.`);
      }

      const company = await companiesRepo.findById(user.tenantId);
      assertCompanyUsable(company);

      const finalUser = await usersRepo.linkGoogleProfile(user.id, {
        googleId: profile.googleId,
        name: profile.name ?? profile.email,
        avatarUrl: profile.picture ?? undefined,
        status: 'active',
        inviteTokenHash: null,
      });

      // Creator convidado nasce active=false (ver creators.service.ts#create) — agora que aceitou
      // o convite, ativa operacionalmente. Colaboradores/gestores não têm linha em creators, então
      // findRowByUserId devolve null e o bloco é pulado sem erro.
      const creatorRow = await creatorsRepo.findRowByUserId(finalUser.tenantId, finalUser.id);
      if (creatorRow && !creatorRow.active) {
        await creatorsRepo.updateRow(finalUser.tenantId, creatorRow.id, { active: true });
      }

      const session = await issueSession(finalUser, userAgent);
      return { ...session, user: await buildUserResponse(finalUser) };
    },

    async refresh(refreshToken: string, userAgent?: string) {
      const tokenHash = hashToken(refreshToken);
      const tokenRow = await refreshTokensRepo.findActiveByHash(tokenHash);
      if (!tokenRow || tokenRow.expiresAt.getTime() < Date.now()) {
        throw unauthorized('INVALID_REFRESH_TOKEN', 'Sessão expirada, faça login novamente.');
      }

      const user = await usersRepo.findById(tokenRow.userId);
      if (!user || user.status !== 'active') {
        throw unauthorized('INVALID_REFRESH_TOKEN', 'Sessão expirada, faça login novamente.');
      }
      // Sem isso, uma sessão aberta antes de a empresa ser suspensa (ou o trial vencer) renovaria
      // o access token pra sempre via refresh_token (30 dias) sem nunca ser bloqueada de fato.
      const company = await companiesRepo.findById(user.tenantId);
      assertCompanyUsable(company);

      await refreshTokensRepo.revoke(tokenRow.id); // rotação: token antigo nunca reutilizável
      const session = await issueSession(user, userAgent);
      return session;
    },

    async logout(refreshToken: string) {
      const tokenHash = hashToken(refreshToken);
      const tokenRow = await refreshTokensRepo.findActiveByHash(tokenHash);
      if (tokenRow) await refreshTokensRepo.revoke(tokenRow.id);
      // idempotente: token desconhecido/já revogado não é erro
    },

    async me(userId: string) {
      const user = await usersRepo.findById(userId);
      if (!user) throw unauthorized('USER_NOT_FOUND', 'Usuário não encontrado.');
      return buildUserResponse(user);
    },

    /** Provisionamento interno de tenant — nunca exposto a usuários finais (ver specs/03). */
    async provisionCompany(input: { name: string; slug: string; adminName: string; adminEmail: string; adminPassword: string }) {
      const passwordHash = await bcrypt.hash(input.adminPassword, 10);
      return createCompanyAndAdmin({ ...input, passwordHash });
    },

    /** Fase 9.1: usado pelo webhook de pagamento — a senha já chega como hash (calculado no momento
     * do /signup, antes de ir pro Checkout) porque a empresa só é criada DEPOIS do pagamento confirmar. */
    async provisionCompanyFromHash(input: { name: string; slug: string; adminName: string; adminEmail: string; passwordHash: string }) {
      return createCompanyAndAdmin(input);
    },

    /** Teste de 4h sem cartão — cria a empresa/admin imediatamente (diferente de startSignup, que
     * só cria depois do pagamento confirmar) e já devolve sessão (login automático), já que não
     * tem checkout nenhum pra redirecionar. Sem isso, a pessoa cadastraria e cairia numa tela de
     * login pra digitar a senha que ela mesma escolheu há 2 segundos — fricção sem propósito. */
    async startTrial(input: { companyName: string; adminName: string; adminEmail: string; adminPassword: string }) {
      const existingUser = await usersRepo.findByEmail(input.adminEmail);
      if (existingUser) throw conflict('EMAIL_TAKEN', 'Já existe uma conta com este e-mail.');

      const passwordHash = await bcrypt.hash(input.adminPassword, 10);
      const slug = await uniqueSlug(slugify(input.companyName), async (s) => !!(await companiesRepo.findBySlug(s)));

      await createCompanyAndAdmin({
        name: input.companyName,
        slug,
        adminName: input.adminName,
        adminEmail: input.adminEmail,
        passwordHash,
        status: 'trial',
        trialEndsAt: new Date(Date.now() + TRIAL_DURATION_MS),
      });

      // createCompanyAndAdmin devolve o admin já sanitizado (sem passwordHash) — buildUserResponse
      // exige o row completo (sanitiza de novo por dentro), por isso busca de novo em vez de reusar.
      const adminUser = await usersRepo.findByEmail(input.adminEmail);
      if (!adminUser) throw conflict('EMAIL_TAKEN', 'Não foi possível concluir o cadastro — tente novamente.');

      // Só loga se falhar — diferente de requestPasswordReset (onde o e-mail é o próprio
      // propósito do endpoint), aqui é um extra: ninguém deveria perder a conta recém-criada por
      // causa de uma falha pontual do Resend.
      try {
        await emailSender.send({
          to: adminUser.email,
          subject: 'Seu teste do CreatorsPro começou — 4 horas pra explorar',
          html: `<p>Olá, ${adminUser.name}.</p>` +
            `<p>Obrigado por testar o CreatorsPro! Você tem <strong>4 horas</strong> de acesso completo — sem cartão, sem compromisso.</p>` +
            `<p>Aproveite pra cadastrar seus creators, montar a escala da semana e ver os relatórios de produção.</p>` +
            `<p>Gostou? Assine um plano e continue de onde parou, sem perder nada do que já configurou: <a href="${env.appUrl}/planos">${env.appUrl}/planos</a></p>`,
        });
      } catch (err) {
        logger.error('trial_welcome_email_failed', { error: err instanceof Error ? err.message : String(err) });
      }

      const session = await issueSession(adminUser);
      return { ...session, user: await buildUserResponse(adminUser) };
    },

    /** Nunca revela se o e-mail existe (evita enumeração) — sempre retorna sem erro, mesmo quando
     * não há nada a fazer (conta não existe, ou está 'pending': convite só com e-mail, nunca teve
     * senha pra resetar — tem que usar o link de convite). Token de uso único, expira em 1h. */
    async requestPasswordReset(email: string) {
      const user = await usersRepo.findByEmail(email);
      if (!user || user.status === 'pending') return;

      const token = generateOpaqueToken();
      const tokenHash = hashToken(token);
      await usersRepo.setPasswordResetToken(user.id, tokenHash, new Date(Date.now() + PASSWORD_RESET_TTL_MS));

      const link = `${env.appUrl}/redefinir-senha/${token}`;
      await emailSender.send({
        to: user.email,
        subject: 'Redefinir sua senha — CreatorsPro',
        html: `<p>Olá, ${user.name}.</p><p>Recebemos um pedido para redefinir sua senha. Este link é válido por 1 hora:</p><p><a href="${link}">${link}</a></p><p>Se não foi você quem pediu, ignore este e-mail — sua senha continua a mesma.</p>`,
      });
    },

    /** Token de uso único (invalidado no mesmo update que troca a senha — ver
     * users.repository.ts#resetPassword) — já devolve sessão (login automático), mesma lógica de
     * startTrial: a pessoa acabou de provar identidade via e-mail, pedir login de novo é fricção
     * sem propósito. */
    async resetPassword(token: string, newPassword: string, userAgent?: string) {
      const tokenHash = hashToken(token);
      const user = await usersRepo.findByPasswordResetTokenHash(tokenHash);
      if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt.getTime() < Date.now()) {
        throw unauthorized('INVALID_RESET_TOKEN', 'Link inválido ou expirado. Solicite um novo.');
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      const finalUser = await usersRepo.resetPassword(user.id, passwordHash);

      // A senha já foi trocada de verdade no passo acima — um bloqueio daqui pra frente (trial
      // vencido, assinatura suspensa) não é "a redefinição falhou", é "a senha mudou, mas a
      // empresa não pode ser usada agora". Por isso o erro carrega o e-mail: quem cai aqui (ex.:
      // trial vencido) consegue ir direto pro fluxo de assinar (mesma mecânica de
      // Login.tsx#upgrade) sem ter que digitar o próprio e-mail de novo — ver ResetPassword.tsx.
      const company = await companiesRepo.findById(finalUser.tenantId);
      try {
        assertCompanyUsable(company);
      } catch (err) {
        if (err instanceof ApiError) throw new ApiError(err.status, err.code, err.message, { email: finalUser.email, password_changed: true });
        throw err;
      }

      const session = await issueSession(finalUser, userAgent);
      return { ...session, user: await buildUserResponse(finalUser) };
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
