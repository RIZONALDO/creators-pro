import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import webpush from 'web-push';
import { resetDb, testDb, testPool } from '../test/db.js';
import { createCompaniesRepository } from '../modules/auth/companies.repository.js';
import { createUsersRepository } from '../modules/auth/users.repository.js';
import { createPushSubscriptionsRepository } from '../modules/push/push.repository.js';
import { createWebPushSender } from './pushSender.js';

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
  },
}));

describe('createWebPushSender', () => {
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);
  const pushRepo = createPushSubscriptionsRepository(testDb);

  beforeEach(async () => {
    await resetDb();
    vi.mocked(webpush.sendNotification).mockReset();
  });

  afterAll(async () => {
    await testPool.end();
  });

  async function setupTenant() {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const user = await usersRepo.create({ tenantId: company.id, name: 'Creator', email: 'creator@acme.com', passwordHash: 'hash', role: 'operacional' });
    return { company, user };
  }

  it('envia pra cada inscrição do usuário com o payload em JSON', async () => {
    const { company, user } = await setupTenant();
    await pushRepo.upsert({ tenantId: company.id, userId: user.id, endpoint: 'https://push.example/1', p256dh: 'p1', auth: 'a1' });
    vi.mocked(webpush.sendNotification).mockResolvedValue({ statusCode: 201, body: '', headers: {} });

    const sender = createWebPushSender(testDb, { publicKey: 'pub', privateKey: 'priv', subject: 'mailto:a@b.com' });
    await sender.sendToUser(company.id, user.id, { title: 'Nova tarefa', body: 'Reels' });

    expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
    const [subscription, payload] = vi.mocked(webpush.sendNotification).mock.calls[0]!;
    expect(subscription).toMatchObject({ endpoint: 'https://push.example/1', keys: { p256dh: 'p1', auth: 'a1' } });
    expect(JSON.parse(payload as string)).toMatchObject({ title: 'Nova tarefa', body: 'Reels' });
  });

  it('endpoint morto (410) é removido da tabela; outras inscrições continuam recebendo', async () => {
    const { company, user } = await setupTenant();
    await pushRepo.upsert({ tenantId: company.id, userId: user.id, endpoint: 'https://push.example/morto', p256dh: 'p1', auth: 'a1' });
    await pushRepo.upsert({ tenantId: company.id, userId: user.id, endpoint: 'https://push.example/vivo', p256dh: 'p2', auth: 'a2' });

    vi.mocked(webpush.sendNotification).mockImplementation(async (sub) => {
      if (sub.endpoint === 'https://push.example/morto') {
        const err = new Error('Gone') as Error & { statusCode: number };
        err.statusCode = 410;
        throw err;
      }
      return { statusCode: 201, body: '', headers: {} };
    });

    const sender = createWebPushSender(testDb, { publicKey: 'pub', privateKey: 'priv', subject: 'mailto:a@b.com' });
    await sender.sendToUser(company.id, user.id, { title: 'Nova tarefa' });

    const remaining = await pushRepo.listByUser(company.id, user.id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.endpoint).toBe('https://push.example/vivo');
  });

  it('sem nenhuma inscrição, não chama sendNotification', async () => {
    const { company, user } = await setupTenant();
    const sender = createWebPushSender(testDb, { publicKey: 'pub', privateKey: 'priv', subject: 'mailto:a@b.com' });

    await sender.sendToUser(company.id, user.id, { title: 'Nova tarefa' });

    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });
});
