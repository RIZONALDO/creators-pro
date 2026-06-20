import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { createServicesRepository } from './services.repository.js';

describe('servicesRepository', () => {
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);
  const servicesRepo = createServicesRepository(testDb);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  it('cria com status default agendado e lista por tenant', async () => {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const user = await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: 'g@acme.com', passwordHash: 'hash', role: 'gestor' });

    const created = await servicesRepo.create({ tenantId: company.id, serviceName: 'Captação aérea', serviceType: 'drone', createdBy: user.id });
    expect(created.status).toBe('agendado');

    const { rows, total } = await servicesRepo.list(company.id, { page: 1, pageSize: 50, offset: 0, limit: 50 });
    expect(total).toBe(1);
    expect(rows[0]?.serviceName).toBe('Captação aérea');
  });

  it('updateStatus muda o status', async () => {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const user = await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: 'g@acme.com', passwordHash: 'hash', role: 'gestor' });
    const created = await servicesRepo.create({ tenantId: company.id, serviceName: 'Edição', createdBy: user.id });

    const updated = await servicesRepo.updateStatus(company.id, created.id, 'concluido');
    expect(updated?.status).toBe('concluido');
  });
});
