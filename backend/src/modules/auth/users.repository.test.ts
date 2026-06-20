import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from './companies.repository.js';
import { createUsersRepository } from './users.repository.js';

describe('usersRepository', () => {
  const usersRepo = createUsersRepository(testDb);
  const companiesRepo = createCompaniesRepository(testDb);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  it('cria um usuário e busca por e-mail', async () => {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const created = await usersRepo.create({
      tenantId: company.id,
      name: 'Fulano',
      email: 'fulano@acme.com',
      passwordHash: 'hash',
      role: 'gestor',
    });

    expect(created.id).toBeDefined();
    expect(created.tenantId).toBe(company.id);

    const found = await usersRepo.findByEmail('fulano@acme.com');
    expect(found?.id).toBe(created.id);
  });

  it('busca por id', async () => {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const created = await usersRepo.create({
      tenantId: company.id,
      name: 'Fulano',
      email: 'fulano2@acme.com',
      passwordHash: 'hash',
      role: 'admin',
    });

    const found = await usersRepo.findById(created.id);
    expect(found?.email).toBe('fulano2@acme.com');
  });

  it('retorna null para e-mail/id inexistente', async () => {
    expect(await usersRepo.findByEmail('nao-existe@acme.com')).toBeNull();
    expect(await usersRepo.findById('00000000-0000-0000-0000-000000000000')).toBeNull();
  });
});
