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
    expect(history.body.data[0].old_status).toBe('na_fila');
    expect(history.body.data[0].new_status).toBe('aprovado');
  });

  it('GET /tasks inclui client_name via JOIN (e null quando sem cliente) — operacional não tem acesso a GET /clients', async () => {
    const { company, gestorToken, passwordHash } = await setupTenant();
    const { creator, token: creatorToken } = await loginAsCreator(company.id, passwordHash);
    const client = await request(app).post('/clients').set('Authorization', `Bearer ${gestorToken}`).send({ name: 'Clínica XYZ' });

    await request(app).post('/tasks').set('Authorization', `Bearer ${gestorToken}`).send({ title: 'Com cliente', creator_id: creator.id, client_id: client.body.id });
    await request(app).post('/tasks').set('Authorization', `Bearer ${gestorToken}`).send({ title: 'Sem cliente', creator_id: creator.id });

    const res = await request(app).get('/tasks').set('Authorization', `Bearer ${creatorToken}`);
    expect(res.status).toBe(200);
    const comCliente = res.body.data.find((t: { title: string }) => t.title === 'Com cliente');
    const semCliente = res.body.data.find((t: { title: string }) => t.title === 'Sem cliente');
    expect(comCliente.client_name).toBe('Clínica XYZ');
    expect(semCliente.client_name).toBeNull();
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

  it('DELETE /tasks/:id remove a tarefa e seu histórico', async () => {
    const { gestorToken } = await setupTenant();
    const created = await request(app).post('/tasks').set('Authorization', `Bearer ${gestorToken}`).send({ title: 'Reels' });
    await request(app).patch(`/tasks/${created.body.id}/status`).set('Authorization', `Bearer ${gestorToken}`).send({ status: 'aprovado' });

    const res = await request(app).delete(`/tasks/${created.body.id}`).set('Authorization', `Bearer ${gestorToken}`);
    expect(res.status).toBe(204);

    const list = await request(app).get('/tasks').set('Authorization', `Bearer ${gestorToken}`);
    expect(list.body.data).toHaveLength(0);

    const history = await request(app)
      .get(`/status-history?entity_type=task&entity_id=${created.body.id}`)
      .set('Authorization', `Bearer ${gestorToken}`);
    expect(history.body.data).toHaveLength(0);
  });

  it('POST /tasks com task_date retroativa retorna 400 TASK_DATE_IN_PAST', async () => {
    const { gestorToken } = await setupTenant();
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    const res = await request(app).post('/tasks').set('Authorization', `Bearer ${gestorToken}`).send({ title: 'Reels', task_date: yesterday.toISOString().slice(0, 10) });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TASK_DATE_IN_PAST');
  });

  it('POST /tasks com creator em ausência aprovada na data retorna 409 ABSENCE_OVERLAPS_TASK', async () => {
    const { company, gestorToken, passwordHash } = await setupTenant();
    const { creator } = await loginAsCreator(company.id, passwordHash);
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const date = tomorrow.toISOString().slice(0, 10);

    await request(app).post('/absences').set('Authorization', `Bearer ${gestorToken}`).send({ creator_id: creator.id, start_date: date, end_date: date });
    const list = await request(app).get('/absences').set('Authorization', `Bearer ${gestorToken}`);
    await request(app).patch(`/absences/${list.body.data[0].id}/review`).set('Authorization', `Bearer ${gestorToken}`).send({ status: 'approved' });

    const res = await request(app).post('/tasks').set('Authorization', `Bearer ${gestorToken}`).send({ title: 'Reels', creator_id: creator.id, task_date: date });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ABSENCE_OVERLAPS_TASK');
  });

  it('DELETE /tasks/:id inexistente retorna 404; operacional recebe 403', async () => {
    const { company, gestorToken, passwordHash } = await setupTenant();
    const { token: creatorToken } = await loginAsCreator(company.id, passwordHash);

    const notFoundRes = await request(app).delete('/tasks/00000000-0000-0000-0000-000000000000').set('Authorization', `Bearer ${gestorToken}`);
    expect(notFoundRes.status).toBe(404);

    const created = await request(app).post('/tasks').set('Authorization', `Bearer ${gestorToken}`).send({ title: 'Reels' });
    const forbiddenRes = await request(app).delete(`/tasks/${created.body.id}`).set('Authorization', `Bearer ${creatorToken}`);
    expect(forbiddenRes.status).toBe(403);
  });
});
