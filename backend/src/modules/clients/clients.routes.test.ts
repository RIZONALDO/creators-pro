import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';

describe('rotas de clients (integração)', () => {
  const app = createApp(testDb);
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  async function loginAsAdmin() {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const passwordHash = await bcrypt.hash('senha123', 4);
    await usersRepo.create({ tenantId: company.id, name: 'Admin', email: 'admin@acme.com', passwordHash, role: 'admin' });
    const login = await request(app).post('/auth/login').send({ email: 'admin@acme.com', password: 'senha123' });
    return login.body.token as string;
  }

  it('CRUD completo de clients via API', async () => {
    const token = await loginAsAdmin();

    const created = await request(app).post('/clients').set('Authorization', `Bearer ${token}`).send({ name: 'Clínica XYZ' });
    expect(created.status).toBe(201);

    const list = await request(app).get('/clients').set('Authorization', `Bearer ${token}`);
    expect(list.body.data).toHaveLength(1);

    const updated = await request(app).put(`/clients/${created.body.id}`).set('Authorization', `Bearer ${token}`).send({ active: false });
    expect(updated.status).toBe(200);
    expect(updated.body.active).toBe(false);
  });

  it('PUT em cliente inexistente retorna 404', async () => {
    const token = await loginAsAdmin();
    const res = await request(app)
      .put('/clients/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ active: false });
    expect(res.status).toBe(404);
  });

  it('DELETE /clients/:id remove quando não há vínculo', async () => {
    const token = await loginAsAdmin();
    const created = await request(app).post('/clients').set('Authorization', `Bearer ${token}`).send({ name: 'Sem vínculo' });

    const res = await request(app).delete(`/clients/${created.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);

    const list = await request(app).get('/clients').set('Authorization', `Bearer ${token}`);
    expect(list.body.data.find((c: { id: string }) => c.id === created.body.id)).toBeUndefined();
  });

  it('DELETE /clients/:id com tarefa vinculada retorna 409 e não apaga nada', async () => {
    const token = await loginAsAdmin();
    const client = await request(app).post('/clients').set('Authorization', `Bearer ${token}`).send({ name: 'Com tarefa' });
    await request(app).post('/tasks').set('Authorization', `Bearer ${token}`).send({ title: 'Reels', client_id: client.body.id });

    const res = await request(app).delete(`/clients/${client.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CLIENT_HAS_LINKED_RECORDS');

    const list = await request(app).get('/clients').set('Authorization', `Bearer ${token}`);
    expect(list.body.data.find((c: { id: string }) => c.id === client.body.id)).toBeDefined();
  });

  it('DELETE /clients/:id inexistente retorna 404', async () => {
    const token = await loginAsAdmin();
    const res = await request(app).delete('/clients/00000000-0000-0000-0000-000000000000').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
