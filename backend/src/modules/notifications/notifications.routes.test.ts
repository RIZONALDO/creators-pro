import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { createNotificationsRepository } from './notifications.repository.js';

describe('rotas de notifications (integração)', () => {
  const app = createApp(testDb);
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);
  const notificationsRepo = createNotificationsRepository(testDb);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  async function setupUser() {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const passwordHash = await bcrypt.hash('senha123', 4);
    const user = await usersRepo.create({ tenantId: company.id, name: 'Creator', email: 'creator@acme.com', passwordHash, role: 'operacional' });
    const login = await request(app).post('/auth/login').send({ email: 'creator@acme.com', password: 'senha123' });
    return { company, user, token: login.body.token as string };
  }

  it('GET /notifications lista só as do usuário logado', async () => {
    const { company, user, token } = await setupUser();
    await notificationsRepo.create({ tenantId: company.id, userId: user.id, type: 'nova_tarefa', title: 'Tarefa nova', description: 'Reels institucional' });

    const res = await request(app).get('/notifications').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Tarefa nova');
    expect(res.body.data[0].is_read).toBe(false);
  });

  it('POST /notifications/read-all marca todas como lidas', async () => {
    const { company, user, token } = await setupUser();
    await notificationsRepo.create({ tenantId: company.id, userId: user.id, type: 'nova_tarefa', title: 'A' });
    await notificationsRepo.create({ tenantId: company.id, userId: user.id, type: 'novo_plantao', title: 'B' });

    const markRead = await request(app).post('/notifications/read-all').set('Authorization', `Bearer ${token}`);
    expect(markRead.status).toBe(204);

    const after = await request(app).get('/notifications').set('Authorization', `Bearer ${token}`);
    expect(after.body.data.every((n: { is_read: boolean }) => n.is_read)).toBe(true);
  });

  it('sem token autenticado, 401', async () => {
    const res = await request(app).get('/notifications');
    expect(res.status).toBe(401);
  });
});
