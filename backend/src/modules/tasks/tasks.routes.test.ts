import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { createCreatorsRepository } from '../creators/creators.repository.js';

describe('rotas de tasks (integração)', () => {
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

  async function setupTenant() {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const passwordHash = await bcrypt.hash('senha123', 4);
    await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: 'gestora@acme.com', passwordHash, role: 'gestor' });
    const login = await request(app).post('/auth/login').send({ email: 'gestora@acme.com', password: 'senha123' });
    return { company, gestorToken: login.body.token as string, passwordHash };
  }

  async function loginAsCreator(tenantId: string, passwordHash: string) {
    const creatorUser = await usersRepo.create({ tenantId, name: 'Creator Op', email: 'creator-op@acme.com', passwordHash, role: 'operacional' });
    const creator = await creatorsRepo.createRow({ tenantId, userId: creatorUser.id, employmentType: 'fixed' });
    const login = await request(app).post('/auth/login').send({ email: 'creator-op@acme.com', password: 'senha123' });
    return { creator, token: login.body.token as string };
  }

  it('POST /tasks cria com status na_fila por default', async () => {
    const { gestorToken } = await setupTenant();
    const res = await request(app).post('/tasks').set('Authorization', `Bearer ${gestorToken}`).send({ title: 'Reels institucional' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('na_fila');
  });

  it('PATCH /tasks/:id/status grava status_history consultável via /status-history', async () => {
    const { gestorToken } = await setupTenant();
    const created = await request(app).post('/tasks').set('Authorization', `Bearer ${gestorToken}`).send({ title: 'Reels' });

    const patched = await request(app).patch(`/tasks/${created.body.id}/status`).set('Authorization', `Bearer ${gestorToken}`).send({ status: 'aprovado' });
    expect(patched.status).toBe(200);
    expect(patched.body.status).toBe('aprovado');

    const history = await request(app)
      .get(`/status-history?entity_type=task&entity_id=${created.body.id}`)
      .set('Authorization', `Bearer ${gestorToken}`);
    expect(history.body.data).toHaveLength(1);
    expect(history.body.data[0].oldStatus).toBe('na_fila');
    expect(history.body.data[0].newStatus).toBe('aprovado');
  });

  it('operacional vê só as próprias tarefas em GET /tasks', async () => {
    const { company, gestorToken, passwordHash } = await setupTenant();
    const { creator, token: creatorToken } = await loginAsCreator(company.id, passwordHash);

    await request(app).post('/tasks').set('Authorization', `Bearer ${gestorToken}`).send({ title: 'Tarefa de outro creator' });
    await request(app).post('/tasks').set('Authorization', `Bearer ${gestorToken}`).send({ title: 'Tarefa do creator logado', creator_id: creator.id });

    const asGestor = await request(app).get('/tasks').set('Authorization', `Bearer ${gestorToken}`);
    const asCreator = await request(app).get('/tasks').set('Authorization', `Bearer ${creatorToken}`);

    expect(asGestor.body.data).toHaveLength(2);
    expect(asCreator.body.data).toHaveLength(1);
    expect(asCreator.body.data[0].title).toBe('Tarefa do creator logado');
  });

  it('operacional recebe 403 ao tentar criar ou mudar status de tarefa', async () => {
    const { company, gestorToken, passwordHash } = await setupTenant();
    const { token: creatorToken } = await loginAsCreator(company.id, passwordHash);
    const created = await request(app).post('/tasks').set('Authorization', `Bearer ${gestorToken}`).send({ title: 'Reels' });

    const createAttempt = await request(app).post('/tasks').set('Authorization', `Bearer ${creatorToken}`).send({ title: 'Tentativa' });
    const statusAttempt = await request(app).patch(`/tasks/${created.body.id}/status`).set('Authorization', `Bearer ${creatorToken}`).send({ status: 'aprovado' });

    expect(createAttempt.status).toBe(403);
    expect(statusAttempt.status).toBe(403);
  });
});
