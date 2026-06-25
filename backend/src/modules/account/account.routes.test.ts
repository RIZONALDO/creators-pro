import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';

describe('rotas de account (integração)', () => {
  const app = createApp(testDb);
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  async function setupTenant(status: 'trial' | 'active' = 'trial') {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme', status, trialEndsAt: status === 'trial' ? new Date(Date.now() + 60 * 60 * 1000) : undefined });
    const passwordHash = await bcrypt.hash('senha123', 4);
    await usersRepo.create({ tenantId: company.id, name: 'Admin', email: 'admin@acme.com', passwordHash, role: 'admin' });
    await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: 'gestora@acme.com', passwordHash, role: 'gestor' });

    const adminLogin = await request(app).post('/auth/login').send({ email: 'admin@acme.com', password: 'senha123' });
    const gestorLogin = await request(app).post('/auth/login').send({ email: 'gestora@acme.com', password: 'senha123' });
    return { company, adminToken: adminLogin.body.token as string, gestorToken: gestorLogin.body.token as string };
  }

  it('DELETE /account sem token -> 401', async () => {
    const res = await request(app).delete('/account');
    expect(res.status).toBe(401);
  });

  it('DELETE /account com gestor -> 403 (só admin)', async () => {
    const { gestorToken } = await setupTenant();
    const res = await request(app).delete('/account').set('Authorization', `Bearer ${gestorToken}`);
    expect(res.status).toBe(403);
  });

  it('DELETE /account com admin em empresa ativa (não trial) -> 409', async () => {
    const { adminToken } = await setupTenant('active');
    const res = await request(app).delete('/account').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ACCOUNT_DELETE_NOT_ALLOWED');
  });

  it('DELETE /account com admin em trial -> 204 e apaga a empresa', async () => {
    const { company, adminToken } = await setupTenant('trial');
    const res = await request(app).delete('/account').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(204);
    expect(await companiesRepo.findById(company.id)).toBeNull();
  });
});
