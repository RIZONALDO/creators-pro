import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';

describe('rotas de services (integração)', () => {
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
    await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: 'gestora@acme.com', passwordHash, role: 'gestor' });
    const login = await request(app).post('/auth/login').send({ email: 'gestora@acme.com', password: 'senha123' });
    return { company, gestorToken: login.body.token as string, passwordHash };
  }

  it('POST /services + PATCH /services/:id/status grava histórico', async () => {
    const { gestorToken } = await setupTenant();

    const created = await request(app).post('/services').set('Authorization', `Bearer ${gestorToken}`).send({ service_name: 'Captação aérea', service_type: 'drone' });
    expect(created.status).toBe(201);

    const patched = await request(app).patch(`/services/${created.body.id}/status`).set('Authorization', `Bearer ${gestorToken}`).send({ status: 'concluido' });
    expect(patched.status).toBe(200);

    const history = await request(app)
      .get(`/status-history?entity_type=service&entity_id=${created.body.id}`)
      .set('Authorization', `Bearer ${gestorToken}`);
    expect(history.body.data).toHaveLength(1);
    expect(history.body.data[0].new_status).toBe('concluido');
  });

  it('operacional recebe 403 ao tentar listar serviços (GET /services requer gestor/admin)', async () => {
    const { company, passwordHash } = await setupTenant();
    await usersRepo.create({ tenantId: company.id, name: 'Op', email: 'op2@acme.com', passwordHash, role: 'operacional' });
    const login = await request(app).post('/auth/login').send({ email: 'op2@acme.com', password: 'senha123' });

    const res = await request(app).get('/services').set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(403);
  });

  it('operacional recebe 403 ao tentar criar serviço', async () => {
    const { company, passwordHash } = await setupTenant();
    await usersRepo.create({ tenantId: company.id, name: 'Op', email: 'op@acme.com', passwordHash, role: 'operacional' });
    const login = await request(app).post('/auth/login').send({ email: 'op@acme.com', password: 'senha123' });

    const res = await request(app).post('/services').set('Authorization', `Bearer ${login.body.token}`).send({ service_name: 'Tentativa' });
    expect(res.status).toBe(403);
  });

  it('DELETE /services/:id remove o serviço e seu histórico', async () => {
    const { gestorToken } = await setupTenant();
    const created = await request(app).post('/services').set('Authorization', `Bearer ${gestorToken}`).send({ service_name: 'Captação' });
    await request(app).patch(`/services/${created.body.id}/status`).set('Authorization', `Bearer ${gestorToken}`).send({ status: 'concluido' });

    const res = await request(app).delete(`/services/${created.body.id}`).set('Authorization', `Bearer ${gestorToken}`);
    expect(res.status).toBe(204);

    const list = await request(app).get('/services').set('Authorization', `Bearer ${gestorToken}`);
    expect(list.body.data).toHaveLength(0);
  });
});
