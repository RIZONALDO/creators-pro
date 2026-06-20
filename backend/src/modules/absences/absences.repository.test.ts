import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { createCreatorsRepository } from '../creators/creators.repository.js';
import { createAbsencesRepository } from './absences.repository.js';

describe('absencesRepository', () => {
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);
  const creatorsRepo = createCreatorsRepository(testDb);
  const absencesRepo = createAbsencesRepository(testDb);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  async function setupCreator() {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const user = await usersRepo.create({ tenantId: company.id, name: 'Creator', email: 'creator@acme.com', passwordHash: 'hash', role: 'operacional' });
    const creator = await creatorsRepo.createRow({ tenantId: company.id, userId: user.id, employmentType: 'fixed' });
    return { company, creator };
  }

  it('cria com status default pending e lista por tenant', async () => {
    const { company, creator } = await setupCreator();
    const created = await absencesRepo.create({ tenantId: company.id, creatorId: creator.id, startDate: '2026-06-24', endDate: '2026-06-26', reason: 'Consulta médica' });
    expect(created.status).toBe('pending');

    const { rows, total } = await absencesRepo.list(company.id, { page: 1, pageSize: 50, offset: 0, limit: 50 });
    expect(total).toBe(1);
    expect(rows[0]?.reason).toBe('Consulta médica');
  });

  it('review muda status e grava approved_by/approved_at', async () => {
    const { company, creator } = await setupCreator();
    const gestor = await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: 'g@acme.com', passwordHash: 'hash', role: 'gestor' });
    const created = await absencesRepo.create({ tenantId: company.id, creatorId: creator.id, startDate: '2026-06-24', endDate: '2026-06-26' });

    const reviewed = await absencesRepo.review(company.id, created.id, 'approved', gestor.id);
    expect(reviewed?.status).toBe('approved');
    expect(reviewed?.approvedBy).toBe(gestor.id);
    expect(reviewed?.approvedAt).toBeInstanceOf(Date);
  });

  it('findApprovedOverlapping só encontra ausência aprovada cobrindo a data', async () => {
    const { company, creator } = await setupCreator();
    const gestor = await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: 'g@acme.com', passwordHash: 'hash', role: 'gestor' });
    const created = await absencesRepo.create({ tenantId: company.id, creatorId: creator.id, startDate: '2026-06-24', endDate: '2026-06-26' });

    expect(await absencesRepo.findApprovedOverlapping(company.id, creator.id, '2026-06-25')).toBeNull(); // ainda pending
    await absencesRepo.review(company.id, created.id, 'approved', gestor.id);

    expect(await absencesRepo.findApprovedOverlapping(company.id, creator.id, '2026-06-25')).not.toBeNull();
    expect(await absencesRepo.findApprovedOverlapping(company.id, creator.id, '2026-06-23')).toBeNull(); // fora do período
    expect(await absencesRepo.findApprovedOverlapping(company.id, creator.id, '2026-06-27')).toBeNull();
  });
});
