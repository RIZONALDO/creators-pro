import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { createCreatorsRepository } from '../creators/creators.repository.js';

describe('rotas de shifts (integração)', () => {
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

  it('POST /shifts + PUT /shifts/:id troca o creator designado', async () => {
    const { company, gestorToken, passwordHash } = await setupTenant();
    const creatorAUser = await usersRepo.create({ tenantId: company.id, name: 'Creator A', email: 'a@acme.com', passwordHash, role: 'operacional' });
    const creatorA = await creatorsRepo.createRow({ tenantId: company.id, userId: creatorAUser.id, employmentType: 'fixed' });
    const creatorBUser = await usersRepo.create({ tenantId: company.id, name: 'Creator B', email: 'b@acme.com', passwordHash, role: 'operacional' });
    const creatorB = await creatorsRepo.createRow({ tenantId: company.id, userId: creatorBUser.id, employmentType: 'fixed' });

    const created = await request(app).post('/shifts').set('Authorization', `Bearer ${gestorToken}`).send({ shift_date: '2026-06-21', creator_id: creatorA.id });
    expect(created.status).toBe(201);

    const swapped = await request(app).put(`/shifts/${created.body.id}`).set('Authorization', `Bearer ${gestorToken}`).send({ creator_id: creatorB.id });
    expect(swapped.status).toBe(200);
    expect(swapped.body.creator_id).toBe(creatorB.id);
  });

  it('PATCH /shifts/:id/status grava status_history', async () => {
    const { gestorToken } = await setupTenant();
    const created = await request(app).post('/shifts').set('Authorization', `Bearer ${gestorToken}`).send({ shift_date: '2026-06-21' });

    const patched = await request(app).patch(`/shifts/${created.body.id}/status`).set('Authorization', `Bearer ${gestorToken}`).send({ status: 'completed' });
    expect(patched.status).toBe(200);

    const history = await request(app).get(`/status-history?entity_type=shift&entity_id=${created.body.id}`).set('Authorization', `Bearer ${gestorToken}`);
    expect(history.body.data).toHaveLength(1);
    expect(history.body.data[0].new_status).toBe('completed');
  });

  it('operacional vê só os próprios plantões', async () => {
    const { company, gestorToken, passwordHash } = await setupTenant();
    const creatorUser = await usersRepo.create({ tenantId: company.id, name: 'Creator', email: 'creator@acme.com', passwordHash, role: 'operacional' });
    const creator = await creatorsRepo.createRow({ tenantId: company.id, userId: creatorUser.id, employmentType: 'fixed' });
    const creatorLogin = await request(app).post('/auth/login').send({ email: 'creator@acme.com', password: 'senha123' });

    await request(app).post('/shifts').set('Authorization', `Bearer ${gestorToken}`).send({ shift_date: '2026-06-21' });
    await request(app).post('/shifts').set('Authorization', `Bearer ${gestorToken}`).send({ shift_date: '2026-06-28', creator_id: creator.id });

    const asCreator = await request(app).get('/shifts').set('Authorization', `Bearer ${creatorLogin.body.token}`);
    expect(asCreator.body.data).toHaveLength(1);
    expect(asCreator.body.data[0].shift_date).toBe('2026-06-28');
  });

  it('operacional de sobreaviso também vê o plantão na própria lista (não só quem é titular)', async () => {
    const { company, gestorToken, passwordHash } = await setupTenant();
    const titularUser = await usersRepo.create({ tenantId: company.id, name: 'Titular', email: 'titular-list@acme.com', passwordHash, role: 'operacional' });
    const titular = await creatorsRepo.createRow({ tenantId: company.id, userId: titularUser.id, employmentType: 'fixed' });
    const standbyUser = await usersRepo.create({ tenantId: company.id, name: 'Sobreaviso', email: 'standby-list@acme.com', passwordHash, role: 'operacional' });
    const standby = await creatorsRepo.createRow({ tenantId: company.id, userId: standbyUser.id, employmentType: 'fixed' });
    const standbyLogin = await request(app).post('/auth/login').send({ email: 'standby-list@acme.com', password: 'senha123' });

    await request(app).post('/shifts').set('Authorization', `Bearer ${gestorToken}`).send({ shift_date: '2026-06-21', creator_id: titular.id, standby_creator_ids: [standby.id] });

    const asStandby = await request(app).get('/shifts').set('Authorization', `Bearer ${standbyLogin.body.token}`);
    expect(asStandby.body.data).toHaveLength(1);
    expect(asStandby.body.data[0].shift_date).toBe('2026-06-21');
    expect(asStandby.body.data[0].standby_creator_ids).toEqual([standby.id]);
    // sobreaviso não tem GET /creators (RBAC) — o nome do titular precisa vir resolvido pela própria API.
    expect(asStandby.body.data[0].creator_name).toBe('Titular');
    expect(asStandby.body.data[0].standby_names).toEqual(['Sobreaviso']);
  });

  it('POST /shifts com creator_id notifica o creator (gatilho novo_plantao)', async () => {
    const { company, gestorToken, passwordHash } = await setupTenant();
    const creatorUser = await usersRepo.create({ tenantId: company.id, name: 'Creator', email: 'creator-notif@acme.com', passwordHash, role: 'operacional' });
    const creator = await creatorsRepo.createRow({ tenantId: company.id, userId: creatorUser.id, employmentType: 'fixed' });

    await request(app).post('/shifts').set('Authorization', `Bearer ${gestorToken}`).send({ shift_date: '2026-06-21', creator_id: creator.id });

    const creatorLogin = await request(app).post('/auth/login').send({ email: 'creator-notif@acme.com', password: 'senha123' });
    const notifications = await request(app).get('/notifications').set('Authorization', `Bearer ${creatorLogin.body.token}`);

    expect(notifications.body.data).toHaveLength(1);
    expect(notifications.body.data[0].type).toBe('novo_plantao');
  });

  it('POST /shifts com standby_creator_ids notifica titular e sobreavisos, e GET /shifts devolve a lista', async () => {
    const { company, gestorToken, passwordHash } = await setupTenant();
    const titularUser = await usersRepo.create({ tenantId: company.id, name: 'Titular', email: 'titular@acme.com', passwordHash, role: 'operacional' });
    const titular = await creatorsRepo.createRow({ tenantId: company.id, userId: titularUser.id, employmentType: 'fixed' });
    const standbyUser = await usersRepo.create({ tenantId: company.id, name: 'Sobreaviso', email: 'sobreaviso@acme.com', passwordHash, role: 'operacional' });
    const standby = await creatorsRepo.createRow({ tenantId: company.id, userId: standbyUser.id, employmentType: 'fixed' });

    const created = await request(app)
      .post('/shifts')
      .set('Authorization', `Bearer ${gestorToken}`)
      .send({ shift_date: '2026-06-21', creator_id: titular.id, standby_creator_ids: [standby.id] });
    expect(created.status).toBe(201);
    expect(created.body.standby_creator_ids).toEqual([standby.id]);
    expect(created.body.creator_name).toBe('Titular');
    expect(created.body.standby_names).toEqual(['Sobreaviso']);

    const list = await request(app).get('/shifts').set('Authorization', `Bearer ${gestorToken}`);
    expect(list.body.data[0].standby_creator_ids).toEqual([standby.id]);
    expect(list.body.data[0].creator_name).toBe('Titular');
    expect(list.body.data[0].standby_names).toEqual(['Sobreaviso']);

    const standbyLogin = await request(app).post('/auth/login').send({ email: 'sobreaviso@acme.com', password: 'senha123' });
    const notifications = await request(app).get('/notifications').set('Authorization', `Bearer ${standbyLogin.body.token}`);
    expect(notifications.body.data[0].type).toBe('novo_plantao');
    expect(notifications.body.data[0].title).toBe('Sobreaviso de plantão');
  });

  it('PUT /shifts/:id atualiza a lista de sobreaviso', async () => {
    const { company, gestorToken, passwordHash } = await setupTenant();
    const creatorAUser = await usersRepo.create({ tenantId: company.id, name: 'A', email: 'standby-a@acme.com', passwordHash, role: 'operacional' });
    const creatorA = await creatorsRepo.createRow({ tenantId: company.id, userId: creatorAUser.id, employmentType: 'fixed' });
    const creatorBUser = await usersRepo.create({ tenantId: company.id, name: 'B', email: 'standby-b@acme.com', passwordHash, role: 'operacional' });
    const creatorB = await creatorsRepo.createRow({ tenantId: company.id, userId: creatorBUser.id, employmentType: 'fixed' });

    const created = await request(app).post('/shifts').set('Authorization', `Bearer ${gestorToken}`).send({ shift_date: '2026-06-21', standby_creator_ids: [creatorA.id] });
    const updated = await request(app).put(`/shifts/${created.body.id}`).set('Authorization', `Bearer ${gestorToken}`).send({ standby_creator_ids: [creatorB.id] });

    expect(updated.status).toBe(200);
    expect(updated.body.standby_creator_ids).toEqual([creatorB.id]);
  });

  it('operacional recebe 403 ao tentar criar ou trocar creator de plantão', async () => {
    const { company, gestorToken, passwordHash } = await setupTenant();
    await usersRepo.create({ tenantId: company.id, name: 'Op', email: 'op@acme.com', passwordHash, role: 'operacional' });
    const opLogin = await request(app).post('/auth/login').send({ email: 'op@acme.com', password: 'senha123' });
    const created = await request(app).post('/shifts').set('Authorization', `Bearer ${gestorToken}`).send({ shift_date: '2026-06-21' });

    const createAttempt = await request(app).post('/shifts').set('Authorization', `Bearer ${opLogin.body.token}`).send({ shift_date: '2026-06-22' });
    const putAttempt = await request(app).put(`/shifts/${created.body.id}`).set('Authorization', `Bearer ${opLogin.body.token}`).send({ notes: 'x' });

    expect(createAttempt.status).toBe(403);
    expect(putAttempt.status).toBe(403);
  });

  it('DELETE /shifts/:id remove o plantão; operacional recebe 403; inexistente retorna 404', async () => {
    const { company, gestorToken, passwordHash } = await setupTenant();
    await usersRepo.create({ tenantId: company.id, name: 'Op', email: 'op-delete@acme.com', passwordHash, role: 'operacional' });
    const opLogin = await request(app).post('/auth/login').send({ email: 'op-delete@acme.com', password: 'senha123' });
    const created = await request(app).post('/shifts').set('Authorization', `Bearer ${gestorToken}`).send({ shift_date: '2026-06-21' });

    const forbiddenAttempt = await request(app).delete(`/shifts/${created.body.id}`).set('Authorization', `Bearer ${opLogin.body.token}`);
    expect(forbiddenAttempt.status).toBe(403);

    const res = await request(app).delete(`/shifts/${created.body.id}`).set('Authorization', `Bearer ${gestorToken}`);
    expect(res.status).toBe(204);

    const list = await request(app).get('/shifts').set('Authorization', `Bearer ${gestorToken}`);
    expect(list.body.data).toHaveLength(0);

    const notFoundAttempt = await request(app).delete(`/shifts/${created.body.id}`).set('Authorization', `Bearer ${gestorToken}`);
    expect(notFoundAttempt.status).toBe(404);
  });
});
