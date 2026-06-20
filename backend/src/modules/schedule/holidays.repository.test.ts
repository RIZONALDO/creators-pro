import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createHolidaysRepository } from './holidays.repository.js';

describe('holidaysRepository', () => {
  const companiesRepo = createCompaniesRepository(testDb);
  const holidaysRepo = createHolidaysRepository(testDb);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  it('listForMonth retorna feriados globais e do tenant, mas não de outro tenant', async () => {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const otherCompany = await companiesRepo.create({ name: 'Other', slug: 'other' });

    await holidaysRepo.createGlobal('2026-06-11', 'Corpus Christi');
    await holidaysRepo.create({ tenantId: company.id, holidayDate: '2026-06-15', description: 'Aniversário da agência' });
    await holidaysRepo.create({ tenantId: otherCompany.id, holidayDate: '2026-06-20', description: 'Feriado de outra empresa' });

    const rows = await holidaysRepo.listForMonth(company.id, 2026, 6);
    const dates = rows.map((r) => r.holidayDate).sort();

    expect(dates).toEqual(['2026-06-11', '2026-06-15']);
  });

  it('createGlobal é idempotente — não duplica o mesmo feriado nacional', async () => {
    await holidaysRepo.createGlobal('2026-01-01', 'Confraternização Universal');
    await holidaysRepo.createGlobal('2026-01-01', 'Confraternização Universal');

    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const rows = await holidaysRepo.listForMonth(company.id, 2026, 1);
    expect(rows).toHaveLength(1);
  });
});
