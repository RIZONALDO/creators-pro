import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createClientsRepository } from './clients.repository.js';

describe('clientsRepository', () => {
  const companiesRepo = createCompaniesRepository(testDb);
  const clientsRepo = createClientsRepository(testDb);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  it('cria, lista e atualiza um cliente dentro do tenant', async () => {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const created = await clientsRepo.create(company.id, { name: 'Governo do Amapá' });

    const { rows, total } = await clientsRepo.list(company.id, { page: 1, pageSize: 50, offset: 0, limit: 50 });
    expect(total).toBe(1);
    expect(rows[0]?.name).toBe('Governo do Amapá');

    const updated = await clientsRepo.update(company.id, created.id, { active: false });
    expect(updated?.active).toBe(false);
  });

  it('não encontra cliente de outro tenant', async () => {
    const companyA = await companiesRepo.create({ name: 'A', slug: 'a' });
    const companyB = await companiesRepo.create({ name: 'B', slug: 'b' });
    const created = await clientsRepo.create(companyA.id, { name: 'Cliente A' });

    expect(await clientsRepo.findById(companyB.id, created.id)).toBeNull();
    expect(await clientsRepo.update(companyB.id, created.id, { active: false })).toBeNull();
  });
});
