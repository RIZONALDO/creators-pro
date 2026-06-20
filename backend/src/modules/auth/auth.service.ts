import bcrypt from 'bcryptjs';
import type { db as Db } from '../../db/client.js';
import { conflict, unauthorized } from '../../lib/errors.js';
import { signAccessToken } from '../../lib/jwt.js';
import { generateOpaqueToken, hashToken } from '../../lib/tokens.js';
import { createCompaniesRepository } from './companies.repository.js';
import { createRefreshTokensRepository } from './refreshTokens.repository.js';
import { createUsersRepository, type CreateUserInput } from './users.repository.js';

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

function sanitizeUser(user: NonNullable<Awaited<ReturnType<ReturnType<typeof createUsersRepository>['findByEmail']>>>) {
  const { passwordHash, ...safe } = user;
  return safe;
}

export function createAuthService(db: typeof Db) {
  const usersRepo = createUsersRepository(db);
  const refreshTokensRepo = createRefreshTokensRepository(db);
  const companiesRepo = createCompaniesRepository(db);

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

      const session = await issueSession(user, userAgent);
      return { ...session, user: sanitizeUser(user) };
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
      return sanitizeUser(user);
    },

    /** Provisionamento interno de tenant — nunca exposto a usuários finais (ver specs/03). */
    async provisionCompany(input: { name: string; slug: string; adminName: string; adminEmail: string; adminPassword: string }) {
      const existing = await companiesRepo.findBySlug(input.slug);
      if (existing) throw conflict('SLUG_TAKEN', 'Já existe uma empresa com este slug.');

      const company = await companiesRepo.create({ name: input.name, slug: input.slug });
      const passwordHash = await bcrypt.hash(input.adminPassword, 10);
      const admin = await usersRepo.create({
        tenantId: company.id,
        name: input.adminName,
        email: input.adminEmail,
        passwordHash,
        role: 'admin',
      } satisfies CreateUserInput);

      return { company, admin: sanitizeUser(admin) };
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
