import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { generateOpaqueToken, hashToken } from '../../lib/tokens.js';
import { createCreatorsRepository } from '../creators/creators.repository.js';
import { createCompaniesRepository } from './companies.repository.js';
import { createUsersRepository } from './users.repository.js';

describe('rotas de auth (integração)', () => {
  const app = createApp(testDb);
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);
  const creatorsRepo = createCreatorsRepository(testDb);

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
    expect(res.body.refresh_token).toBeDefined();
    expect(res.body.user.email).toBe('fulano@acme.com');
    expect(res.body.user.creator_id).toBeNull();
  });

  it('POST /auth/google sem id_token retorna 400 (validação)', async () => {
    const res = await request(app).post('/auth/google').send({});
    expect(res.status).toBe(400);
  });

  it('POST /auth/google retorna 400 GOOGLE_NOT_CONFIGURED quando o servidor não tem GOOGLE_CLIENT_ID (.env.test não define)', async () => {
    const res = await request(app).post('/auth/google').send({ id_token: 'qualquer-coisa' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('GOOGLE_NOT_CONFIGURED');
  });

  it('POST /auth/google/claim sem token ou id_token retorna 400 (validação)', async () => {
    const res = await request(app).post('/auth/google/claim').send({ token: 'x' });
    expect(res.status).toBe(400);
  });

  it('POST /auth/google/claim com token que não existe retorna 401 INVALID_INVITE_TOKEN (checado antes mesmo de chamar o Google)', async () => {
    const res = await request(app).post('/auth/google/claim').send({ token: 'token-que-nunca-existiu', id_token: 'qualquer-coisa' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_INVITE_TOKEN');
  });

  it('POST /auth/login de operacional com creator vinculado já inclui creator_id (sem precisar de /auth/me)', async () => {
    const { company } = await createDemoUser();
    const passwordHash = await bcrypt.hash('senha-correta', 4);
    const creatorUser = await usersRepo.create({ tenantId: company.id, name: 'Creator', email: 'creator-login@acme.com', passwordHash, role: 'operacional' });
    const creator = await creatorsRepo.createRow({ tenantId: company.id, userId: creatorUser.id, employmentType: 'fixed' });

    const res = await request(app).post('/auth/login').send({ email: 'creator-login@acme.com', password: 'senha-correta' });

    expect(res.status).toBe(200);
    expect(res.body.user.creator_id).toBe(creator.id);
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
    expect(res.body.user.creator_id).toBeNull(); // gestor não tem creator vinculado
  });

  it('GET /auth/me de um operacional com creator vinculado inclui creator_id', async () => {
    const { company } = await createDemoUser();
    const passwordHash = await bcrypt.hash('senha-correta', 4);
    const creatorUser = await usersRepo.create({ tenantId: company.id, name: 'Creator', email: 'creator@acme.com', passwordHash, role: 'operacional' });
    const creator = await creatorsRepo.createRow({ tenantId: company.id, userId: creatorUser.id, employmentType: 'fixed' });
    const login = await request(app).post('/auth/login').send({ email: 'creator@acme.com', password: 'senha-correta' });

    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.creator_id).toBe(creator.id);
  });

  it('login de operacional sem creator vinculado retorna collaborator_id null (colaboradores não têm login)', async () => {
    const { company } = await createDemoUser();
    const passwordHash = await bcrypt.hash('senha-correta', 4);
    await usersRepo.create({ tenantId: company.id, name: 'Op Sem Vínculo', email: 'op-sem-vinculo@acme.com', passwordHash, role: 'operacional' });

    const res = await request(app).post('/auth/login').send({ email: 'op-sem-vinculo@acme.com', password: 'senha-correta' });

    expect(res.status).toBe(200);
    expect(res.body.user.creator_id).toBeNull();
    expect(res.body.user.collaborator_id).toBeNull();
    expect(res.body.user.profession).toBeNull();
  });

  it('POST /auth/refresh emite novo par de tokens', async () => {
    await createDemoUser();
    const login = await request(app).post('/auth/login').send({ email: 'fulano@acme.com', password: 'senha-correta' });

    const res = await request(app).post('/auth/refresh').send({ refresh_token: login.body.refresh_token });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('POST /auth/logout revoga a sessão (refresh subsequente falha)', async () => {
    await createDemoUser();
    const login = await request(app).post('/auth/login').send({ email: 'fulano@acme.com', password: 'senha-correta' });

    const logoutRes = await request(app).post('/auth/logout').send({ refresh_token: login.body.refresh_token });
    expect(logoutRes.status).toBe(204);

    const refreshRes = await request(app).post('/auth/refresh').send({ refresh_token: login.body.refresh_token });
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

  it('POST /auth/forgot-password sempre 204, com e-mail existindo ou não', async () => {
    await createDemoUser();
    const withAccount = await request(app).post('/auth/forgot-password').send({ email: 'fulano@acme.com' });
    const withoutAccount = await request(app).post('/auth/forgot-password').send({ email: 'ninguem@acme.com' });

    expect(withAccount.status).toBe(204);
    expect(withoutAccount.status).toBe(204);
  });

  it('POST /auth/reset-password com token válido troca a senha e devolve sessão', async () => {
    const { user } = await createDemoUser();
    const token = generateOpaqueToken();
    await usersRepo.setPasswordResetToken(user.id, hashToken(token), new Date(Date.now() + 60 * 60 * 1000));

    const res = await request(app).post('/auth/reset-password').send({ token, password: 'senha-nova123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();

    const login = await request(app).post('/auth/login').send({ email: 'fulano@acme.com', password: 'senha-nova123' });
    expect(login.status).toBe(200);
  });

  it('POST /auth/reset-password com token inválido retorna 401', async () => {
    const res = await request(app).post('/auth/reset-password').send({ token: 'token-invalido', password: 'senha-nova123' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_RESET_TOKEN');
  });
});
