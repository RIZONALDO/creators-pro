import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { createNotificationsRepository } from './notifications.repository.js';

describe('notificationsRepository', () => {
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);
  const notificationsRepo = createNotificationsRepository(testDb);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  async function setupTenant() {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const user = await usersRepo.create({ tenantId: company.id, name: 'Creator', email: 'creator@acme.com', passwordHash: 'hash', role: 'operacional' });
    return { company, user };
  }

  it('list devolve só as notificações do usuário, mais recentes primeiro', async () => {
    const { company, user } = await setupTenant();
    const other = await usersRepo.create({ tenantId: company.id, name: 'Outro', email: 'outro@acme.com', passwordHash: 'hash', role: 'operacional' });

    await notificationsRepo.create({ tenantId: company.id, userId: user.id, type: 'nova_tarefa', title: 'Primeira' });
    await notificationsRepo.create({ tenantId: company.id, userId: user.id, type: 'novo_plantao', title: 'Segunda' });
    await notificationsRepo.create({ tenantId: company.id, userId: other.id, type: 'nova_tarefa', title: 'Da outra pessoa' });

    const { rows, total } = await notificationsRepo.list(company.id, user.id, { page: 1, pageSize: 50, offset: 0, limit: 50 });
    expect(total).toBe(2);
    expect(rows.map((r) => r.title)).toEqual(['Segunda', 'Primeira']);
  });

  it('markAllRead marca só as do próprio usuário/tenant como lidas', async () => {
    const { company, user } = await setupTenant();
    const other = await usersRepo.create({ tenantId: company.id, name: 'Outro', email: 'outro@acme.com', passwordHash: 'hash', role: 'operacional' });

    await notificationsRepo.create({ tenantId: company.id, userId: user.id, type: 'nova_tarefa', title: 'A' });
    await notificationsRepo.create({ tenantId: company.id, userId: user.id, type: 'novo_plantao', title: 'B' });
    await notificationsRepo.create({ tenantId: company.id, userId: other.id, type: 'nova_tarefa', title: 'C' });

    await notificationsRepo.markAllRead(company.id, user.id);

    const { rows } = await notificationsRepo.list(company.id, user.id, { page: 1, pageSize: 50, offset: 0, limit: 50 });
    expect(rows.every((r) => r.isRead)).toBe(true);

    const { rows: otherRows } = await notificationsRepo.list(company.id, other.id, { page: 1, pageSize: 50, offset: 0, limit: 50 });
    expect(otherRows[0]?.isRead).toBe(false);
  });
});
