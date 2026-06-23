import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { createPushSubscriptionsRepository } from './push.repository.js';

describe('rotas de push (integração)', () => {
  const app = createApp(testDb);
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);
  const pushRepo = createPushSubscriptionsRepository(testDb);

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

  it('GET /push/vapid-public-key sem VAPID configurado (.env.test) devolve null, não erro', async () => {
    const { token } = await setupUser();
    const res = await request(app).get('/push/vapid-public-key').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.public_key).toBeNull();
  });

  it('POST /push/subscribe grava a inscrição; POST /push/unsubscribe remove', async () => {
    const { company, user, token } = await setupUser();
    const sub = { endpoint: 'https://push.example/sub1', keys: { p256dh: 'p256dh-key', auth: 'auth-key' } };

    const subscribed = await request(app).post('/push/subscribe').set('Authorization', `Bearer ${token}`).send(sub);
    expect(subscribed.status).toBe(204);

    let rows = await pushRepo.listByUser(company.id, user.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.endpoint).toBe(sub.endpoint);

    const unsubscribed = await request(app).post('/push/unsubscribe').set('Authorization', `Bearer ${token}`).send({ endpoint: sub.endpoint });
    expect(unsubscribed.status).toBe(204);

    rows = await pushRepo.listByUser(company.id, user.id);
    expect(rows).toHaveLength(0);
  });

  it('POST /push/subscribe sem token autenticado falha com 401', async () => {
    const res = await request(app).post('/push/subscribe').send({ endpoint: 'https://push.example/x', keys: { p256dh: 'a', auth: 'b' } });
    expect(res.status).toBe(401);
  });

  it('POST /push/subscribe com body inválido (sem keys) falha com 400', async () => {
    const { token } = await setupUser();
    const res = await request(app).post('/push/subscribe').set('Authorization', `Bearer ${token}`).send({ endpoint: 'https://push.example/sem-keys' });
    expect(res.status).toBe(400);
  });
});
