import bcrypt from 'bcryptjs';
import type { db as Db } from '../../db/client.js';
import { conflict, paymentRequired, unauthorized } from '../../lib/errors.js';
import { signAccessToken } from '../../lib/jwt.js';
import { sanitizeUser } from '../../lib/sanitizeUser.js';
import { generateOpaqueToken, hashToken } from '../../lib/tokens.js';
import { createCreatorsRepository } from '../creators/creators.repository.js';
import { createCollaboratorsRepository } from '../collaborators/collaborators.repository.js';
import { createCompanyRepository } from '../company/company.repository.js';
import { createCompaniesRepository } from './companies.repository.js';
import { createRefreshTokensRepository } from './refreshTokens.repository.js';
import { createUsersRepository, type CreateUserInput } from './users.repository.js';

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

export function createAuthService(db: typeof Db) {
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

  /** Núcleo compartilhado por provisionCompany() (senha em texto puro, /internal/companies) e
   * provisionCompanyFromHash() (hash já pronto, vindo do webhook de pagamento — Fase 9.1). */
  async function createCompanyAndAdmin(input: { name: string; slug: string; adminName: string; adminEmail: string; passwordHash: string }) {
    const existing = await companiesRepo.findBySlug(input.slug);
    if (existing) throw conflict('SLUG_TAKEN', 'Já existe uma empresa com este slug.');

    const company = await companiesRepo.create({ name: input.name, slug: input.slug });
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

      const passwordOk = await bcrypt.compare(password, user.passwordHash);
      if (!passwordOk) {
        throw unauthorized('INVALID_CREDENTIALS', 'E-mail ou senha inválidos.');
      }

      // Fase 9.1: credenciais corretas, mas a assinatura da empresa não está ativa (pagamento
      // falhou/cancelou) — 402, não 401, pra não confundir com "senha errada" no frontend.
      const company = await companiesRepo.findById(user.tenantId);
      if (!company || company.status !== 'active') {
        throw paymentRequired('SUBSCRIPTION_INACTIVE', 'Assinatura suspensa ou cancelada. Atualize o pagamento para continuar.');
      }

      const session = await issueSession(user, userAgent);
      return { ...session, user: await buildUserResponse(user) };
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
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
