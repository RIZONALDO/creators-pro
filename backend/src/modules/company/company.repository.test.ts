import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createCompanyRepository } from './company.repository.js';

describe('companyRepository', () => {
  const companiesRepo = createCompaniesRepository(testDb);
  const repo = createCompanyRepository(testDb);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  it('findByTenant devolve null quando ainda não existe linha pra esse tenant', async () => {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    expect(await repo.findByTenant(company.id)).toBeNull();
  });

  it('upsert na primeira chamada cria a linha (usando defaults pro que não foi enviado)', async () => {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const row = await repo.upsert(company.id, { displayName: 'Acme Produções' });
    expect(row).toMatchObject({ tenantId: company.id, displayName: 'Acme Produções', timezone: 'America/Sao_Paulo', locale: 'pt-BR' });
  });

  it('upsert na segunda chamada atualiza em vez de duplicar, mantendo o que não foi enviado', async () => {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    await repo.upsert(company.id, { displayName: 'Acme Produções', timezone: 'America/Sao_Paulo' });
    const updated = await repo.upsert(company.id, { logoUrl: 'https://cdn.example/logo.png' });

    expect(updated).toMatchObject({ tenantId: company.id, displayName: 'Acme Produções', logoUrl: 'https://cdn.example/logo.png', timezone: 'America/Sao_Paulo' });
    expect(await repo.findByTenant(company.id)).toMatchObject({ displayName: 'Acme Produções', logoUrl: 'https://cdn.example/logo.png' });
  });
});
