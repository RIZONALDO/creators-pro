import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { createCollaboratorsRepository } from '../collaborators/collaborators.repository.js';

describe('rotas de services (integração)', () => {
  const app = createApp(testDb);
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);
  const collaboratorsRepo = createCollaboratorsRepository(testDb);

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
    expect(history.body.data[0].newStatus).toBe('concluido');
  });

  it('operacional vê só os próprios serviços', async () => {
    const { company, gestorToken, passwordHash } = await setupTenant();
    const collabUser = await usersRepo.create({ tenantId: company.id, name: 'Colab', email: 'colab@acme.com', passwordHash, role: 'operacional' });
    const collaborator = await collaboratorsRepo.createRow({ tenantId: company.id, userId: collabUser.id, profession: 'Fotógrafo', employmentType: 'fixed' });
    const collabLogin = await request(app).post('/auth/login').send({ email: 'colab@acme.com', password: 'senha123' });

    await request(app).post('/services').set('Authorization', `Bearer ${gestorToken}`).send({ service_name: 'Serviço de outro colaborador' });
    await request(app)
      .post('/services')
      .set('Authorization', `Bearer ${gestorToken}`)
      .send({ service_name: 'Serviço do colaborador logado', collaborator_id: collaborator.id });

    const asCollaborator = await request(app).get('/services').set('Authorization', `Bearer ${collabLogin.body.token}`);
    expect(asCollaborator.body.data).toHaveLength(1);
    expect(asCollaborator.body.data[0].serviceName).toBe('Serviço do colaborador logado');
  });

  it('operacional recebe 403 ao tentar criar serviço', async () => {
    const { company, passwordHash } = await setupTenant();
    await usersRepo.create({ tenantId: company.id, name: 'Op', email: 'op@acme.com', passwordHash, role: 'operacional' });
    const login = await request(app).post('/auth/login').send({ email: 'op@acme.com', password: 'senha123' });

    const res = await request(app).post('/services').set('Authorization', `Bearer ${login.body.token}`).send({ service_name: 'Tentativa' });
    expect(res.status).toBe(403);
  });
});
