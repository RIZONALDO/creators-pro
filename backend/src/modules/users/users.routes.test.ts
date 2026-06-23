import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';

describe('rotas de users (integração)', () => {
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
    return { company, token: login.body.token as string };
  }

  it('POST /users cria um coordenador sem expor passwordHash', async () => {
    const { token } = await loginAsAdmin();

    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Fernanda', email: 'fernanda2@acme.com', role: 'gestor', password: 'senha12345' });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe('gestor');
    expect(res.body.password_hash).toBeUndefined();
  });

  it('POST /users com role operacional retorna 400 — conta operacional só nasce via /creators ou /collaborators', async () => {
    const { token } = await loginAsAdmin();

    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Fantasma', email: 'fantasma@acme.com', role: 'operacional', password: 'senha12345' });

    expect(res.status).toBe(400);
  });

  it('GET /users lista paginado', async () => {
    const { token } = await loginAsAdmin();
    await request(app).post('/users').set('Authorization', `Bearer ${token}`).send({ name: 'A', email: 'a@acme.com', role: 'gestor', password: 'senha12345' });

    const res = await request(app).get('/users').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2); // admin + criado
    expect(res.body.meta.total).toBeGreaterThanOrEqual(2);
  });

  it('PUT /users/:id muda role/status', async () => {
    const { token } = await loginAsAdmin();
    const created = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'A', email: 'a2@acme.com', role: 'gestor', password: 'senha12345' });

    const res = await request(app).put(`/users/${created.body.id}`).set('Authorization', `Bearer ${token}`).send({ status: 'inactive' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('inactive');
  });

  it('POST /users aceita alias customizado e PUT /users/:id atualiza esse alias', async () => {
    const { token } = await loginAsAdmin();
    const created = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Diretora', email: 'diretora@acme.com', role: 'admin', password: 'senha12345', alias: 'Diretora Geral' });

    expect(created.status).toBe(201);
    expect(created.body.alias).toBe('Diretora Geral');

    const updated = await request(app).put(`/users/${created.body.id}`).set('Authorization', `Bearer ${token}`).send({ alias: 'CEO' });
    expect(updated.status).toBe(200);
    expect(updated.body.alias).toBe('CEO');
  });

  it('GET /users distingue Creator de Colaborador dentro do role operacional (creator_id/collaborator_id)', async () => {
    const { token } = await loginAsAdmin();
    await request(app).post('/creators').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Creator A', email: 'creatora@acme.com', employment_type: 'fixed', password: 'senha12345' });
    await request(app).post('/collaborators').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Colab A', email: 'colaba@acme.com', profession: 'Editor', employment_type: 'freelancer', password: 'senha12345' });

    const res = await request(app).get('/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const creatorUser = res.body.data.find((u: { email: string }) => u.email === 'creatora@acme.com');
    const colabUser = res.body.data.find((u: { email: string }) => u.email === 'colaba@acme.com');
    expect(creatorUser).toMatchObject({ role: 'operacional', creator_id: expect.any(String), collaborator_id: null, profession: null });
    expect(colabUser).toMatchObject({ role: 'operacional', creator_id: null, collaborator_id: expect.any(String), profession: 'Editor' });
  });

  it('gestor recebe 403 em /users (admin only)', async () => {
    const { company } = await loginAsAdmin();
    const passwordHash = await bcrypt.hash('senha123', 4);
    await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: 'gestora@acme.com', passwordHash, role: 'gestor' });
    const gestorLogin = await request(app).post('/auth/login').send({ email: 'gestora@acme.com', password: 'senha123' });

    const res = await request(app).get('/users').set('Authorization', `Bearer ${gestorLogin.body.token}`);
    expect(res.status).toBe(403);
  });

  it('POST /users com e-mail duplicado retorna 409', async () => {
    const { token } = await loginAsAdmin();
    await request(app).post('/users').set('Authorization', `Bearer ${token}`).send({ name: 'A', email: 'dup@acme.com', role: 'gestor', password: 'senha12345' });

    const res = await request(app).post('/users').set('Authorization', `Bearer ${token}`).send({ name: 'B', email: 'dup@acme.com', role: 'gestor', password: 'senha12345' });
    expect(res.status).toBe(409);
  });
});
