import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { createCreatorsRepository } from '../creators/creators.repository.js';
import { createTasksRepository } from './tasks.repository.js';

describe('tasksRepository', () => {
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);
  const creatorsRepo = createCreatorsRepository(testDb);
  const tasksRepo = createTasksRepository(testDb);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  it('cria com status default na_fila e lista por tenant', async () => {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const user = await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: 'g@acme.com', passwordHash: 'hash', role: 'gestor' });

    const created = await tasksRepo.create({ tenantId: company.id, title: 'Reels institucional', createdBy: user.id });
    expect(created.status).toBe('na_fila');

    const { rows, total } = await tasksRepo.list(company.id, { page: 1, pageSize: 50, offset: 0, limit: 50 });
    expect(total).toBe(1);
    expect(rows[0]?.title).toBe('Reels institucional');
  });

  it('filtra por creatorId quando informado', async () => {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const user = await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: 'g@acme.com', passwordHash: 'hash', role: 'gestor' });
    const creatorUser = await usersRepo.create({ tenantId: company.id, name: 'Creator', email: 'creator@acme.com', passwordHash: 'hash', role: 'operacional' });
    const creator = await creatorsRepo.createRow({ tenantId: company.id, userId: creatorUser.id, employmentType: 'fixed' });

    await tasksRepo.create({ tenantId: company.id, title: 'Tarefa sem creator', createdBy: user.id });
    const withCreator = await tasksRepo.create({ tenantId: company.id, title: 'Tarefa com creator', createdBy: user.id, creatorId: creator.id });

    const { rows, total } = await tasksRepo.list(company.id, { page: 1, pageSize: 50, offset: 0, limit: 50 }, { creatorId: creator.id });
    expect(total).toBe(1);
    expect(rows[0]?.id).toBe(withCreator.id);
  });

  it('updateStatus muda o status sem precisar de outros campos', async () => {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const user = await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: 'g@acme.com', passwordHash: 'hash', role: 'gestor' });
    const created = await tasksRepo.create({ tenantId: company.id, title: 'Tarefa', createdBy: user.id });

    const updated = await tasksRepo.updateStatus(company.id, created.id, 'aprovado');
    expect(updated?.status).toBe('aprovado');
  });
});
