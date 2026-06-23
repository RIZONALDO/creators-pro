import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';
import type { RealtimeEmitter } from '../../realtime/emitter.js';
import type { PushSender } from '../../realtime/pushSender.js';
import { createNotificationsService } from './notifications.service.js';

describe('notificationsService.notify', () => {
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  it('grava a notification, emite notification:new e dispara push na mesma chamada', async () => {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const user = await usersRepo.create({ tenantId: company.id, name: 'Creator', email: 'creator@acme.com', passwordHash: 'hash', role: 'operacional' });

    const emitter: RealtimeEmitter = { toUser: vi.fn() };
    const pushSender: PushSender = { sendToUser: vi.fn().mockResolvedValue(undefined) };
    const service = createNotificationsService(testDb, emitter, pushSender);

    const row = await service.notify(company.id, user.id, 'nova_tarefa', 'Nova tarefa', 'Reels institucional');

    expect(row.type).toBe('nova_tarefa');
    expect(emitter.toUser).toHaveBeenCalledWith(user.id, 'notification:new', expect.objectContaining({ type: 'nova_tarefa' }));
    expect(pushSender.sendToUser).toHaveBeenCalledWith(
      company.id,
      user.id,
      expect.objectContaining({ title: 'Nova tarefa', body: 'Reels institucional' }),
    );
  });

  it('sem emitter/pushSender informados (defaults noop), não lança erro', async () => {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const user = await usersRepo.create({ tenantId: company.id, name: 'Creator', email: 'creator2@acme.com', passwordHash: 'hash', role: 'operacional' });
    const service = createNotificationsService(testDb);

    await expect(service.notify(company.id, user.id, 'novo_plantao', 'Novo plantão')).resolves.toMatchObject({ type: 'novo_plantao' });
  });
});
