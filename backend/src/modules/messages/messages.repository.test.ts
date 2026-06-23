import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { createMessagesRepository } from './messages.repository.js';

describe('messagesRepository', () => {
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);
  const messagesRepo = createMessagesRepository(testDb);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  async function setupTenant() {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const a = await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: 'a@acme.com', passwordHash: 'hash', role: 'gestor' });
    const b = await usersRepo.create({ tenantId: company.id, name: 'Creator', email: 'b@acme.com', passwordHash: 'hash', role: 'operacional' });
    return { company, a, b };
  }

  it('listThread devolve as mensagens entre os dois, em ordem cronológica, dos dois lados', async () => {
    const { company, a, b } = await setupTenant();
    await messagesRepo.create({ tenantId: company.id, senderId: a.id, receiverId: b.id, message: 'Oi' });
    await messagesRepo.create({ tenantId: company.id, senderId: b.id, receiverId: a.id, message: 'Oi, tudo bem?' });

    const { rows, total } = await messagesRepo.listThread(company.id, a.id, b.id, { page: 1, pageSize: 50, offset: 0, limit: 50 });
    expect(total).toBe(2);
    expect(rows.map((r) => r.message)).toEqual(['Oi', 'Oi, tudo bem?']);
  });

  it('listCounterparts devolve 1 entrada por interlocutor, mais recente primeiro', async () => {
    const { company, a, b } = await setupTenant();
    const c = await usersRepo.create({ tenantId: company.id, name: 'Outro Creator', email: 'c@acme.com', passwordHash: 'hash', role: 'operacional' });

    await messagesRepo.create({ tenantId: company.id, senderId: a.id, receiverId: b.id, message: '1' });
    await messagesRepo.create({ tenantId: company.id, senderId: a.id, receiverId: c.id, message: '2' });
    await messagesRepo.create({ tenantId: company.id, senderId: b.id, receiverId: a.id, message: '3' });

    const counterparts = await messagesRepo.listCounterparts(company.id, a.id);
    expect(counterparts).toHaveLength(2);
    expect(counterparts[0]?.counterpartId).toBe(b.id); // última troca foi com b (mensagem '3')
  });

  it('unreadCount só conta mensagens não lidas na direção certa; markThreadRead zera', async () => {
    const { company, a, b } = await setupTenant();
    await messagesRepo.create({ tenantId: company.id, senderId: b.id, receiverId: a.id, message: 'não lida 1' });
    await messagesRepo.create({ tenantId: company.id, senderId: b.id, receiverId: a.id, message: 'não lida 2' });
    await messagesRepo.create({ tenantId: company.id, senderId: a.id, receiverId: b.id, message: 'enviada por a, não conta pro unread de a' });

    expect(await messagesRepo.unreadCount(company.id, a.id, b.id)).toBe(2);

    await messagesRepo.markThreadRead(company.id, a.id, b.id);
    expect(await messagesRepo.unreadCount(company.id, a.id, b.id)).toBe(0);
  });
});
