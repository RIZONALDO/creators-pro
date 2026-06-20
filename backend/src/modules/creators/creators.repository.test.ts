import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { createCreatorsRepository } from './creators.repository.js';

describe('creatorsRepository', () => {
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);
  const creatorsRepo = createCreatorsRepository(testDb);

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
      name: 'Creator Um',
      email: `creator-${emailSuffix}@acme.com`,
      passwordHash: 'hash',
      role: 'operacional',
    });
    return { company, user };
  }

  it('cria e lista creators com o nome/e-mail/telefone do usuário vinculado', async () => {
    const { company, user } = await createTenantWithUser('1');
    await creatorsRepo.createRow({ tenantId: company.id, userId: user.id, employmentType: 'fixed' });

    const { rows, total } = await creatorsRepo.list(company.id, { page: 1, pageSize: 50, offset: 0, limit: 50 });

    expect(total).toBe(1);
    expect(rows[0]?.name).toBe('Creator Um');
    expect(rows[0]?.employmentType).toBe('fixed');
  });

  it('findById só encontra dentro do tenant correto', async () => {
    const { company, user } = await createTenantWithUser('2');
    const created = await creatorsRepo.createRow({ tenantId: company.id, userId: user.id, employmentType: 'freelancer' });

    const { company: otherCompany } = await createTenantWithUser('3');

    expect(await creatorsRepo.findById(company.id, created.id)).not.toBeNull();
    expect(await creatorsRepo.findById(otherCompany.id, created.id)).toBeNull();
  });

  it('updateRow atualiza employment_type/active', async () => {
    const { company, user } = await createTenantWithUser('4');
    const created = await creatorsRepo.createRow({ tenantId: company.id, userId: user.id, employmentType: 'fixed', active: true });

    await creatorsRepo.updateRow(company.id, created.id, { active: false });

    const found = await creatorsRepo.findRowById(company.id, created.id);
    expect(found?.active).toBe(false);
  });
});
