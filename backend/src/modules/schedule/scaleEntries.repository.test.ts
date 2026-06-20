import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { createCreatorsRepository } from '../creators/creators.repository.js';
import { createScaleMonthsRepository } from './scaleMonths.repository.js';
import { createScaleEntriesRepository } from './scaleEntries.repository.js';

describe('scaleEntriesRepository', () => {
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);
  const creatorsRepo = createCreatorsRepository(testDb);
  const scaleMonthsRepo = createScaleMonthsRepository(testDb);
  const scaleEntriesRepo = createScaleEntriesRepository(testDb);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  it('upsertAssignment cria na primeira chamada e atualiza na segunda (mesma work_date)', async () => {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const user = await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: 'g@acme.com', passwordHash: 'hash', role: 'gestor' });
    const creatorUser = await usersRepo.create({ tenantId: company.id, name: 'Creator', email: 'creator@acme.com', passwordHash: 'hash', role: 'operacional' });
    const creator = await creatorsRepo.createRow({ tenantId: company.id, userId: creatorUser.id, employmentType: 'fixed' });
    const scaleMonth = await scaleMonthsRepo.create({ tenantId: company.id, month: 6, year: 2026, createdBy: user.id });

    const created = await scaleEntriesRepo.upsertAssignment({ tenantId: company.id, scaleMonthId: scaleMonth.id, workDate: '2026-06-22', creatorId: null, isHoliday: false });
    expect(created.creatorId).toBeNull();

    const updated = await scaleEntriesRepo.upsertAssignment({ tenantId: company.id, scaleMonthId: scaleMonth.id, workDate: '2026-06-22', creatorId: creator.id, isHoliday: false });
    expect(updated.id).toBe(created.id); // mesma linha, não duplicou
    expect(updated.creatorId).toBe(creator.id);

    const rows = await scaleEntriesRepo.listByMonth(company.id, scaleMonth.id);
    expect(rows).toHaveLength(1);
  });

  it('createMany insere várias linhas de uma vez e listByMonth retorna em ordem de data', async () => {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const user = await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: 'g@acme.com', passwordHash: 'hash', role: 'gestor' });
    const scaleMonth = await scaleMonthsRepo.create({ tenantId: company.id, month: 6, year: 2026, createdBy: user.id });

    await scaleEntriesRepo.createMany([
      { tenantId: company.id, scaleMonthId: scaleMonth.id, workDate: '2026-06-02' },
      { tenantId: company.id, scaleMonthId: scaleMonth.id, workDate: '2026-06-01' },
    ]);

    const rows = await scaleEntriesRepo.listByMonth(company.id, scaleMonth.id);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.workDate).toBe('2026-06-01');
    expect(rows[1]?.workDate).toBe('2026-06-02');
  });
});
