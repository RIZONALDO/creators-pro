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
});
