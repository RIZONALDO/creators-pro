import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { createCollaboratorsRepository } from './collaborators.repository.js';

describe('collaboratorsRepository', () => {
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);
  const collaboratorsRepo = createCollaboratorsRepository(testDb);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  async function createTenantWithUser(emailSuffix: string) {
    const company = await companiesRepo.create({ name: 'Acme', slug: `acme-${emailSuffix}` });
    const user = await usersRepo.create({
      tenantId: company.id,
      name: 'Colaborador Um',
      email: `colab-${emailSuffix}@acme.com`,
      passwordHash: 'hash',
      role: 'operacional',
    });
    return { company, user };
  }

  it('cria e lista collaborators com profissão e dados do usuário', async () => {
    const { company, user } = await createTenantWithUser('1');
    await collaboratorsRepo.createRow({ tenantId: company.id, userId: user.id, profession: 'Fotógrafo', employmentType: 'freelancer' });

    const { rows, total } = await collaboratorsRepo.list(company.id, { page: 1, pageSize: 50, offset: 0, limit: 50 });

    expect(total).toBe(1);
    expect(rows[0]?.profession).toBe('Fotógrafo');
    expect(rows[0]?.name).toBe('Colaborador Um');
  });

  it('findById só encontra dentro do tenant correto', async () => {
    const { company, user } = await createTenantWithUser('2');
    const created = await collaboratorsRepo.createRow({ tenantId: company.id, userId: user.id, profession: 'Editor', employmentType: 'fixed' });

    const { company: otherCompany } = await createTenantWithUser('3');

    expect(await collaboratorsRepo.findById(company.id, created.id)).not.toBeNull();
    expect(await collaboratorsRepo.findById(otherCompany.id, created.id)).toBeNull();
  });
});
