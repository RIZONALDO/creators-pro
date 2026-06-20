import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { createStatusHistoryRepository } from './statusHistory.repository.js';

describe('statusHistoryRepository', () => {
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);
  const statusHistoryRepo = createStatusHistoryRepository(testDb);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  it('grava e lista o histórico em ordem cronológica', async () => {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const user = await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: 'g@acme.com', passwordHash: 'hash', role: 'gestor' });
    const fakeTaskId = '00000000-0000-0000-0000-000000000001';

    await statusHistoryRepo.record({ tenantId: company.id, entityType: 'task', entityId: fakeTaskId, oldStatus: null, newStatus: 'na_fila', changedBy: user.id });
    await statusHistoryRepo.record({ tenantId: company.id, entityType: 'task', entityId: fakeTaskId, oldStatus: 'na_fila', newStatus: 'em_edicao', changedBy: user.id });

    const history = await statusHistoryRepo.list(company.id, 'task', fakeTaskId);
    expect(history).toHaveLength(2);
    expect(history[0]?.newStatus).toBe('na_fila');
    expect(history[1]?.oldStatus).toBe('na_fila');
    expect(history[1]?.newStatus).toBe('em_edicao');
  });
});
