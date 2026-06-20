import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';

describe('rotas de creators (integração)', () => {
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
    return { company, token: login.body.token as string };
  }

  async function loginAsOperacional(tenantId: string) {
    const passwordHash = await bcrypt.hash('senha123', 4);
    await usersRepo.create({ tenantId, name: 'Operacional', email: 'op@acme.com', passwordHash, role: 'operacional' });
    const login = await request(app).post('/auth/login').send({ email: 'op@acme.com', password: 'senha123' });
    return login.body.token as string;
  }

  it('POST /creators cria usuário + creator', async () => {
    const { token } = await loginAsGestor();

    const res = await request(app)
      .post('/creators')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Novo Creator', email: 'novo-creator@acme.com', employment_type: 'fixed' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Novo Creator');
    expect(res.body.employmentType).toBe('fixed');
  });

  it('POST /creators com e-mail duplicado retorna 409', async () => {
    const { token } = await loginAsGestor();
    await request(app).post('/creators').set('Authorization', `Bearer ${token}`).send({ name: 'A', email: 'dup@acme.com', employment_type: 'fixed' });

    const res = await request(app).post('/creators').set('Authorization', `Bearer ${token}`).send({ name: 'B', email: 'dup@acme.com', employment_type: 'fixed' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('GET /creators lista os criados', async () => {
    const { token } = await loginAsGestor();
    await request(app).post('/creators').set('Authorization', `Bearer ${token}`).send({ name: 'A', email: 'a@acme.com', employment_type: 'fixed' });

    const res = await request(app).get('/creators').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
  });

  it('PUT /creators/:id atualiza active', async () => {
    const { token } = await loginAsGestor();
    const created = await request(app)
      .post('/creators')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'A', email: 'a@acme.com', employment_type: 'fixed' });

    const res = await request(app).put(`/creators/${created.body.id}`).set('Authorization', `Bearer ${token}`).send({ active: false });

    expect(res.status).toBe(200);
    expect(res.body.active).toBe(false);
  });

  it('operacional recebe 403 em /creators (RBAC)', async () => {
    const { company } = await loginAsGestor();
    const opToken = await loginAsOperacional(company.id);

    const res = await request(app).get('/creators').set('Authorization', `Bearer ${opToken}`);
    expect(res.status).toBe(403);
  });
});
