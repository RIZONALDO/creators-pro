import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';

describe('rotas de professions (integração)', () => {
  const app = createApp(testDb);
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  async function loginAsGestor() {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const passwordHash = await bcrypt.hash('senha123', 4);
    await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: 'gestora@acme.com', passwordHash, role: 'gestor' });
    const login = await request(app).post('/auth/login').send({ email: 'gestora@acme.com', password: 'senha123' });
    return login.body.token as string;
  }

  it('GET /professions retorna lista vazia inicialmente', async () => {
    const token = await loginAsGestor();
    const res = await request(app).get('/professions').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });

  it('POST /professions cria profissão e GET a retorna', async () => {
    const token = await loginAsGestor();
    const created = await request(app).post('/professions').set('Authorization', `Bearer ${token}`).send({ name: 'Drone Sênior' });

    expect(created.status).toBe(201);
    expect(created.body.name).toBe('Drone Sênior');
    expect(typeof created.body.id).toBe('string');

    const list = await request(app).get('/professions').set('Authorization', `Bearer ${token}`);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].name).toBe('Drone Sênior');
  });

  it('DELETE /professions/:id remove a profissão', async () => {
    const token = await loginAsGestor();
    const created = await request(app).post('/professions').set('Authorization', `Bearer ${token}`).send({ name: 'Videógrafo' });

    const res = await request(app).delete(`/professions/${created.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);

    const list = await request(app).get('/professions').set('Authorization', `Bearer ${token}`);
    expect(list.body.data).toHaveLength(0);
  });
});
