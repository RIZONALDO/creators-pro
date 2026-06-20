import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from './companies.repository.js';
import { createUsersRepository } from './users.repository.js';

describe('rotas de auth (integração)', () => {
  const app = createApp(testDb);
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  async function createDemoUser() {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const passwordHash = await bcrypt.hash('senha-correta', 4);
    const user = await usersRepo.create({
      tenantId: company.id,
      name: 'Fulano',
      email: 'fulano@acme.com',
      passwordHash,
      role: 'gestor',
    });
    return { company, user };
  }

  it('POST /auth/login retorna token + user', async () => {
    await createDemoUser();

    const res = await request(app).post('/auth/login').send({ email: 'fulano@acme.com', password: 'senha-correta' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.email).toBe('fulano@acme.com');
  });

  it('POST /auth/login com senha errada retorna 401', async () => {
    await createDemoUser();

    const res = await request(app).post('/auth/login').send({ email: 'fulano@acme.com', password: 'errada' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('GET /auth/me sem token retorna 401', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('GET /auth/me com token válido retorna o usuário', async () => {
    await createDemoUser();
    const login = await request(app).post('/auth/login').send({ email: 'fulano@acme.com', password: 'senha-correta' });

    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('fulano@acme.com');
  });

  it('POST /auth/refresh emite novo par de tokens', async () => {
    await createDemoUser();
    const login = await request(app).post('/auth/login').send({ email: 'fulano@acme.com', password: 'senha-correta' });

    const res = await request(app).post('/auth/refresh').send({ refreshToken: login.body.refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('POST /auth/logout revoga a sessão (refresh subsequente falha)', async () => {
    await createDemoUser();
    const login = await request(app).post('/auth/login').send({ email: 'fulano@acme.com', password: 'senha-correta' });

    const logoutRes = await request(app).post('/auth/logout').send({ refreshToken: login.body.refreshToken });
    expect(logoutRes.status).toBe(204);

    const refreshRes = await request(app).post('/auth/refresh').send({ refreshToken: login.body.refreshToken });
    expect(refreshRes.status).toBe(401);
  });

  it('POST /internal/companies sem secret de plataforma retorna 401', async () => {
    const res = await request(app).post('/internal/companies').send({
      name: 'Nova Empresa',
      slug: 'nova-empresa-2',
      adminName: 'Admin',
      adminEmail: 'admin@nova2.com',
      adminPassword: 'senha12345',
    });

    expect(res.status).toBe(401);
  });

  it('POST /internal/companies com secret correto cria o tenant', async () => {
    const res = await request(app)
      .post('/internal/companies')
      .set('x-platform-secret', process.env.PLATFORM_PROVISION_SECRET ?? '')
      .send({
        name: 'Nova Empresa',
        slug: 'nova-empresa-3',
        adminName: 'Admin',
        adminEmail: 'admin@nova3.com',
        adminPassword: 'senha12345',
      });

    expect(res.status).toBe(201);
    expect(res.body.company.slug).toBe('nova-empresa-3');
  });
});
