import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { createCreatorsRepository } from '../creators/creators.repository.js';
import { createStatusHistoryRepository } from '../statusHistory/statusHistory.repository.js';
import { createAbsencesService } from './absences.service.js';

describe('absencesService', () => {
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);
  const creatorsRepo = createCreatorsRepository(testDb);
  const statusHistoryRepo = createStatusHistoryRepository(testDb);
  const absencesService = createAbsencesService(testDb);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  async function setupTenant() {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const gestor = await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: 'g@acme.com', passwordHash: 'hash', role: 'gestor' });
    const creatorUser = await usersRepo.create({ tenantId: company.id, name: 'Creator', email: 'creator@acme.com', passwordHash: 'hash', role: 'operacional' });
    const creator = await creatorsRepo.createRow({ tenantId: company.id, userId: creatorUser.id, employmentType: 'fixed' });
    return { company, gestor, creator, creatorUser };
  }

  it('operacional só pode solicitar para o próprio creator vinculado', async () => {
    const { company, creator, creatorUser } = await setupTenant();
    const otherUser = await usersRepo.create({ tenantId: company.id, name: 'Outro', email: 'outro@acme.com', passwordHash: 'hash', role: 'operacional' });

    const ownAuth = { userId: creatorUser.id, tenantId: company.id, role: 'operacional' as const };
    const otherAuth = { userId: otherUser.id, tenantId: company.id, role: 'operacional' as const };

    const created = await absencesService.create(ownAuth, { creator_id: creator.id, start_date: '2026-06-24', end_date: '2026-06-26' });
    expect(created.creatorId).toBe(creator.id);

    await expect(
      absencesService.create(otherAuth, { creator_id: creator.id, start_date: '2026-06-24', end_date: '2026-06-26' }),
    ).rejects.toMatchObject({ code: 'CANNOT_REQUEST_FOR_OTHER_CREATOR' });
  });

  it('gestor pode registrar ausência em nome de qualquer creator do tenant', async () => {
    const { company, gestor, creator } = await setupTenant();
    const gestorAuth = { userId: gestor.id, tenantId: company.id, role: 'gestor' as const };

    const created = await absencesService.create(gestorAuth, { creator_id: creator.id, start_date: '2026-06-24', end_date: '2026-06-26' });
    expect(created.creatorId).toBe(creator.id);
  });

  it('end_date antes de start_date falha com INVALID_DATE_RANGE', async () => {
    const { company, gestor, creator } = await setupTenant();
    const gestorAuth = { userId: gestor.id, tenantId: company.id, role: 'gestor' as const };

    await expect(
      absencesService.create(gestorAuth, { creator_id: creator.id, start_date: '2026-06-26', end_date: '2026-06-24' }),
    ).rejects.toMatchObject({ code: 'INVALID_DATE_RANGE' });
  });

  it('review grava exatamente 1 linha em status_history', async () => {
    const { company, gestor, creator } = await setupTenant();
    const gestorAuth = { userId: gestor.id, tenantId: company.id, role: 'gestor' as const };
    const created = await absencesService.create(gestorAuth, { creator_id: creator.id, start_date: '2026-06-24', end_date: '2026-06-26' });

    await absencesService.review(company.id, created.id, 'approved', gestor.id);

    const history = await statusHistoryRepo.list(company.id, 'absence', created.id);
    expect(history).toHaveLength(1);
    expect(history[0]?.oldStatus).toBe('pending');
    expect(history[0]?.newStatus).toBe('approved');
  });

  it('operacional sem creator vinculado vê lista vazia', async () => {
    const { company } = await setupTenant();
    const opUser = await usersRepo.create({ tenantId: company.id, name: 'Op', email: 'op@acme.com', passwordHash: 'hash', role: 'operacional' });

    const { rows, total } = await absencesService.list({ userId: opUser.id, tenantId: company.id, role: 'operacional' }, { page: 1, pageSize: 50, offset: 0, limit: 50 });
    expect(total).toBe(0);
    expect(rows).toHaveLength(0);
  });
});
