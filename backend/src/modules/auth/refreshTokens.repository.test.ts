import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from './companies.repository.js';
import { createUsersRepository } from './users.repository.js';
import { createRefreshTokensRepository } from './refreshTokens.repository.js';

describe('refreshTokensRepository', () => {
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);
  const refreshTokensRepo = createRefreshTokensRepository(testDb);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  async function createUser() {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    return usersRepo.create({ tenantId: company.id, name: 'Fulano', email: 'fulano@acme.com', passwordHash: 'hash', role: 'gestor' });
  }

  it('cria um token e encontra por hash enquanto ativo', async () => {
    const user = await createUser();
    const created = await refreshTokensRepo.create({
      tenantId: user.tenantId,
      userId: user.id,
      tokenHash: 'hash-abc',
      expiresAt: new Date(Date.now() + 1000 * 60),
    });

    const found = await refreshTokensRepo.findActiveByHash('hash-abc');
    expect(found?.id).toBe(created.id);
  });

  it('revoga um token e ele deixa de ser encontrado como ativo', async () => {
    const user = await createUser();
    const created = await refreshTokensRepo.create({
      tenantId: user.tenantId,
      userId: user.id,
      tokenHash: 'hash-def',
      expiresAt: new Date(Date.now() + 1000 * 60),
    });

    await refreshTokensRepo.revoke(created.id);

    const found = await refreshTokensRepo.findActiveByHash('hash-def');
    expect(found).toBeNull();
  });
});
