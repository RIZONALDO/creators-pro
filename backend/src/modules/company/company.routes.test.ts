import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';

describe('rotas de company (integração)', () => {
  const app = createApp(testDb);
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  async function setupTenant() {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const passwordHash = await bcrypt.hash('senha123', 4);
    await usersRepo.create({ tenantId: company.id, name: 'Admin', email: 'admin@acme.com', passwordHash, role: 'admin' });
    await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: 'gestora@acme.com', passwordHash, role: 'gestor' });
    await usersRepo.create({ tenantId: company.id, name: 'Op', email: 'op@acme.com', passwordHash, role: 'operacional' });

    const adminLogin = await request(app).post('/auth/login').send({ email: 'admin@acme.com', password: 'senha123' });
    const gestorLogin = await request(app).post('/auth/login').send({ email: 'gestora@acme.com', password: 'senha123' });
    const opLogin = await request(app).post('/auth/login').send({ email: 'op@acme.com', password: 'senha123' });
    return {
      company,
      adminToken: adminLogin.body.token as string,
      gestorToken: gestorLogin.body.token as string,
      opToken: opLogin.body.token as string,
    };
  }

  it('GET /company/settings sem linha ainda devolve defaults (não 404)', async () => {
    const { gestorToken } = await setupTenant();
    const res = await request(app).get('/company/settings').set('Authorization', `Bearer ${gestorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ display_name: null, timezone: 'America/Sao_Paulo', locale: 'pt-BR' });
  });

  it('GET é liberado pra qualquer papel autenticado (admin, gestor, operacional)', async () => {
    const { adminToken, gestorToken, opToken } = await setupTenant();
    for (const token of [adminToken, gestorToken, opToken]) {
      const res = await request(app).get('/company/settings').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    }
  });

  it('PUT só admin — gestor e operacional recebem 403', async () => {
    const { gestorToken, opToken } = await setupTenant();
    const asGestor = await request(app).put('/company/settings').set('Authorization', `Bearer ${gestorToken}`).send({ display_name: 'Novo nome' });
    const asOp = await request(app).put('/company/settings').set('Authorization', `Bearer ${opToken}`).send({ display_name: 'Novo nome' });
    expect(asGestor.status).toBe(403);
    expect(asOp.status).toBe(403);
  });

  it('PUT como admin grava e GET seguinte já reflete', async () => {
    const { adminToken, gestorToken } = await setupTenant();
    const put = await request(app).put('/company/settings').set('Authorization', `Bearer ${adminToken}`).send({ display_name: 'Acme Produções', timezone: 'America/Manaus' });
    expect(put.status).toBe(200);
    expect(put.body.data).toMatchObject({ display_name: 'Acme Produções', timezone: 'America/Manaus' });

    const get = await request(app).get('/company/settings').set('Authorization', `Bearer ${gestorToken}`);
    expect(get.body.data).toMatchObject({ display_name: 'Acme Produções', timezone: 'America/Manaus' });
  });

  it('PUT como admin grava app_name/app_subtitle separado de display_name (dados do app vs. dados da empresa)', async () => {
    const { adminToken } = await setupTenant();
    const put = await request(app).put('/company/settings').set('Authorization', `Bearer ${adminToken}`).send({
      display_name: 'Acme Produções', app_name: 'Acme OS', app_subtitle: 'GESTÃO DE CONTEÚDO',
    });
    expect(put.status).toBe(200);
    expect(put.body.data).toMatchObject({ display_name: 'Acme Produções', app_name: 'Acme OS', app_subtitle: 'GESTÃO DE CONTEÚDO' });
  });

  it('PUT rejeita logo_url que não é uma URL válida (400)', async () => {
    const { adminToken } = await setupTenant();
    const res = await request(app).put('/company/settings').set('Authorization', `Bearer ${adminToken}`).send({ logo_url: 'não-é-url' });
    expect(res.status).toBe(400);
  });

  it('sem token autenticado, 401', async () => {
    const res = await request(app).get('/company/settings');
    expect(res.status).toBe(401);
  });
});
