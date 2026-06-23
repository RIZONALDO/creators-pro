import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { createPushSubscriptionsRepository } from './push.repository.js';

describe('pushSubscriptionsRepository', () => {
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);
  const pushRepo = createPushSubscriptionsRepository(testDb);

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

  it('upsert pelo mesmo endpoint atualiza em vez de duplicar', async () => {
    const { company, user } = await setupTenant();
    await pushRepo.upsert({ tenantId: company.id, userId: user.id, endpoint: 'https://push.example/abc', p256dh: 'p1', auth: 'a1' });
    await pushRepo.upsert({ tenantId: company.id, userId: user.id, endpoint: 'https://push.example/abc', p256dh: 'p2', auth: 'a2' });

    const rows = await pushRepo.listByUser(company.id, user.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.p256dh).toBe('p2');
  });

  it('listByUser só devolve as inscrições do próprio usuário/tenant', async () => {
    const { company, user } = await setupTenant();
    const other = await usersRepo.create({ tenantId: company.id, name: 'Outro', email: 'outro@acme.com', passwordHash: 'hash', role: 'operacional' });
    await pushRepo.upsert({ tenantId: company.id, userId: user.id, endpoint: 'https://push.example/u1', p256dh: 'p', auth: 'a' });
    await pushRepo.upsert({ tenantId: company.id, userId: other.id, endpoint: 'https://push.example/u2', p256dh: 'p', auth: 'a' });

    const rows = await pushRepo.listByUser(company.id, user.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.endpoint).toBe('https://push.example/u1');
  });

  it('deleteByEndpoint remove só a inscrição daquele tenant/endpoint', async () => {
    const { company, user } = await setupTenant();
    await pushRepo.upsert({ tenantId: company.id, userId: user.id, endpoint: 'https://push.example/del', p256dh: 'p', auth: 'a' });

    await pushRepo.deleteByEndpoint(company.id, 'https://push.example/del');

    const rows = await pushRepo.listByUser(company.id, user.id);
    expect(rows).toHaveLength(0);
  });
});
