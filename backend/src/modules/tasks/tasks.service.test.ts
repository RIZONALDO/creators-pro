import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { createCreatorsRepository } from '../creators/creators.repository.js';
import { createStatusHistoryRepository } from '../statusHistory/statusHistory.repository.js';
import { createTasksService } from './tasks.service.js';

describe('tasksService', () => {
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);
  const creatorsRepo = createCreatorsRepository(testDb);
  const statusHistoryRepo = createStatusHistoryRepository(testDb);
  const tasksService = createTasksService(testDb);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  async function setupTenant() {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const gestor = await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: 'g@acme.com', passwordHash: 'hash', role: 'gestor' });
    return { company, gestor };
  }

  it('setStatus grava exatamente 1 linha em status_history com old/new corretos', async () => {
    const { company, gestor } = await setupTenant();
    const task = await tasksService.create(company.id, gestor.id, { title: 'Reels' });

    await tasksService.setStatus(company.id, task.id, 'em_edicao', gestor.id);

    const history = await statusHistoryRepo.list(company.id, 'task', task.id);
    expect(history).toHaveLength(1);
    expect(history[0]?.oldStatus).toBe('na_fila');
    expect(history[0]?.newStatus).toBe('em_edicao');
    expect(history[0]?.changedBy).toBe(gestor.id);
  });

  it('duas mudanças de status seguidas geram 2 linhas encadeadas', async () => {
    const { company, gestor } = await setupTenant();
    const task = await tasksService.create(company.id, gestor.id, { title: 'Reels' });

    await tasksService.setStatus(company.id, task.id, 'em_edicao', gestor.id);
    await tasksService.setStatus(company.id, task.id, 'aprovado', gestor.id);

    const history = await statusHistoryRepo.list(company.id, 'task', task.id);
    expect(history).toHaveLength(2);
    expect(history[1]?.oldStatus).toBe('em_edicao');
    expect(history[1]?.newStatus).toBe('aprovado');
  });

  it('create com creator_id de outro tenant falha com INVALID_CREATOR', async () => {
    const { company, gestor } = await setupTenant();
    const otherCompany = await companiesRepo.create({ name: 'Other', slug: 'other' });
    const otherUser = await usersRepo.create({ tenantId: otherCompany.id, name: 'U', email: 'u@other.com', passwordHash: 'hash', role: 'operacional' });
    const otherCreator = await creatorsRepo.createRow({ tenantId: otherCompany.id, userId: otherUser.id, employmentType: 'fixed' });

    await expect(tasksService.create(company.id, gestor.id, { title: 'X', creator_id: otherCreator.id })).rejects.toMatchObject({
      code: 'INVALID_CREATOR',
    });
  });

  it('operacional sem creator vinculado vê lista vazia', async () => {
    const { company } = await setupTenant();
    const opUser = await usersRepo.create({ tenantId: company.id, name: 'Op', email: 'op@acme.com', passwordHash: 'hash', role: 'operacional' });

    const { rows, total } = await tasksService.list({ userId: opUser.id, tenantId: company.id, role: 'operacional' }, { page: 1, pageSize: 50, offset: 0, limit: 50 });
    expect(total).toBe(0);
    expect(rows).toHaveLength(0);
  });
});
