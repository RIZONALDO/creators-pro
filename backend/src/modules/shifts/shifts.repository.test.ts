import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { createShiftsRepository } from './shifts.repository.js';

describe('shiftsRepository', () => {
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);
  const shiftsRepo = createShiftsRepository(testDb);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  it('cria com status default scheduled e lista por tenant', async () => {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const user = await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: 'g@acme.com', passwordHash: 'hash', role: 'gestor' });

    const created = await shiftsRepo.create({ tenantId: company.id, shiftDate: '2026-06-21', notes: 'Turno manhã', createdBy: user.id });
    expect(created.status).toBe('scheduled');

    const { rows, total } = await shiftsRepo.list(company.id, { page: 1, pageSize: 50, offset: 0, limit: 50 });
    expect(total).toBe(1);
    expect(rows[0]?.notes).toBe('Turno manhã');
  });

  it('updateStatus muda o status', async () => {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const user = await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: 'g@acme.com', passwordHash: 'hash', role: 'gestor' });
    const created = await shiftsRepo.create({ tenantId: company.id, shiftDate: '2026-06-21', createdBy: user.id });

    const updated = await shiftsRepo.updateStatus(company.id, created.id, 'completed');
    expect(updated?.status).toBe('completed');
  });

  it('delete remove o plantão e devolve true; false se já não existe', async () => {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const user = await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: 'g@acme.com', passwordHash: 'hash', role: 'gestor' });
    const created = await shiftsRepo.create({ tenantId: company.id, shiftDate: '2026-06-21', createdBy: user.id });

    expect(await shiftsRepo.delete(company.id, created.id)).toBe(true);
    expect(await shiftsRepo.findById(company.id, created.id)).toBeNull();
    expect(await shiftsRepo.delete(company.id, created.id)).toBe(false);
  });
});
