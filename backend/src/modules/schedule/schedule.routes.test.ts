import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { createCreatorsRepository } from '../creators/creators.repository.js';
import { createAbsencesRepository } from '../absences/absences.repository.js';

describe('rotas de schedule (integração)', () => {
  const app = createApp(testDb);
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);
  const creatorsRepo = createCreatorsRepository(testDb);
  const absencesRepo = createAbsencesRepository(testDb);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  async function loginAsGestor() {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const passwordHash = await bcrypt.hash('senha123', 4);
    await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: 'gestora@acme.com', passwordHash, role: 'gestor' });
    const login = await request(app).post('/auth/login').send({ email: 'gestora@acme.com', password: 'senha123' });
    return { company, token: login.body.token as string };
  }

  async function createCreator(company: { id: string }, email: string) {
    const user = await usersRepo.create({ tenantId: company.id, name: 'Creator', email, passwordHash: await bcrypt.hash('x', 4), role: 'operacional' });
    return creatorsRepo.createRow({ tenantId: company.id, userId: user.id, employmentType: 'fixed' });
  }

  async function createCreatorWithUser(company: { id: string }, email: string) {
    const user = await usersRepo.create({ tenantId: company.id, name: 'Creator', email, passwordHash: await bcrypt.hash('x', 4), role: 'operacional' });
    const creator = await creatorsRepo.createRow({ tenantId: company.id, userId: user.id, employmentType: 'fixed' });
    return { creator, user };
  }

  it('GET /scale-entries começa vazio (linhas só existem depois de atribuição real)', async () => {
    const { token } = await loginAsGestor();
    const res = await request(app).get('/scale-entries?month=2026-06').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.scale_month_id).toBeDefined();
  });

  it('POST /scale-entries/:work_date atribui um creator', async () => {
    const { company, token } = await loginAsGestor();
    const creator = await createCreator(company, 'creator@acme.com');

    const res = await request(app).post('/scale-entries/2026-06-22').set('Authorization', `Bearer ${token}`).send({ creator_id: creator.id });

    expect(res.status).toBe(201);
    expect(res.body.creator_id).toBe(creator.id);
  });

  it('POST /scale-entries/:work_date permite um segundo creator no mesmo dia, e rejeita o mesmo creator de novo (409)', async () => {
    const { company, token } = await loginAsGestor();
    const creatorA = await createCreator(company, 'a@acme.com');
    const creatorB = await createCreator(company, 'b@acme.com');

    const first = await request(app).post('/scale-entries/2026-06-22').set('Authorization', `Bearer ${token}`).send({ creator_id: creatorA.id });
    const second = await request(app).post('/scale-entries/2026-06-22').set('Authorization', `Bearer ${token}`).send({ creator_id: creatorB.id });
    const dup = await request(app).post('/scale-entries/2026-06-22').set('Authorization', `Bearer ${token}`).send({ creator_id: creatorA.id });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('ALREADY_ASSIGNED');

    const list = await request(app).get('/scale-entries?month=2026-06').set('Authorization', `Bearer ${token}`);
    expect(list.body.data.filter((e: { work_date: string }) => e.work_date === '2026-06-22')).toHaveLength(2);
  });

  it('DELETE /scale-entries/:work_date/:creator_id remove só aquele creator do dia', async () => {
    const { company, token } = await loginAsGestor();
    const creatorA = await createCreator(company, 'a@acme.com');
    const creatorB = await createCreator(company, 'b@acme.com');
    await request(app).post('/scale-entries/2026-06-22').set('Authorization', `Bearer ${token}`).send({ creator_id: creatorA.id });
    await request(app).post('/scale-entries/2026-06-22').set('Authorization', `Bearer ${token}`).send({ creator_id: creatorB.id });

    const del = await request(app).delete(`/scale-entries/2026-06-22/${creatorA.id}`).set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(204);

    const list = await request(app).get('/scale-entries?month=2026-06').set('Authorization', `Bearer ${token}`);
    const day22 = list.body.data.filter((e: { work_date: string }) => e.work_date === '2026-06-22');
    expect(day22).toHaveLength(1);
    expect(day22[0].creator_id).toBe(creatorB.id);
  });

  it('DELETE /scale-entries/:work_date/:creator_id devolve 404 se o creator não está nesse dia', async () => {
    const { company, token } = await loginAsGestor();
    const creator = await createCreator(company, 'creator@acme.com');

    const del = await request(app).delete(`/scale-entries/2026-06-22/${creator.id}`).set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(404);
  });

  it('POST /scale-entries/:work_date com ausência aprovada cobrindo a data retorna 409', async () => {
    const { company, token } = await loginAsGestor();
    const { creator, user } = await createCreatorWithUser(company, 'creator2@acme.com');
    const absence = await absencesRepo.create({ tenantId: company.id, creatorId: creator.id, startDate: '2026-06-24', endDate: '2026-06-26' });
    await absencesRepo.review(company.id, absence.id, 'approved', user.id);

    const res = await request(app).post('/scale-entries/2026-06-25').set('Authorization', `Bearer ${token}`).send({ creator_id: creator.id });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ABSENCE_OVERLAPS_SCHEDULE');
  });

  it('POST /scale-entries/:work_date em fim de semana retorna 400', async () => {
    const { company, token } = await loginAsGestor();
    const creator = await createCreator(company, 'creator3@acme.com');
    const res = await request(app).post('/scale-entries/2026-06-20').set('Authorization', `Bearer ${token}`).send({ creator_id: creator.id });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_WORK_DATE');
  });

  it('POST /scale-months/:id/auto-assign distribui round-robin', async () => {
    const { company, token } = await loginAsGestor();
    for (let i = 0; i < 2; i++) {
      await createCreator(company, `creator${i}@acme.com`);
    }

    const list = await request(app).get('/scale-entries?month=2026-06').set('Authorization', `Bearer ${token}`);
    const auto = await request(app).post(`/scale-months/${list.body.scale_month_id}/auto-assign`).set('Authorization', `Bearer ${token}`);

    expect(auto.status).toBe(200);
    expect(auto.body.data.filter((e: { creator_id: string | null }) => e.creator_id !== null)).toHaveLength(22);
  });

  it('operacional recebe 403 ao tentar atribuir, remover ou rodar escala automática', async () => {
    const { company, token } = await loginAsGestor();
    const passwordHash = await bcrypt.hash('senha123', 4);
    await usersRepo.create({ tenantId: company.id, name: 'Op', email: 'op@acme.com', passwordHash, role: 'operacional' });
    const opLogin = await request(app).post('/auth/login').send({ email: 'op@acme.com', password: 'senha123' });
    const creator = await createCreator(company, 'creator-op@acme.com');

    const list = await request(app).get('/scale-entries?month=2026-06').set('Authorization', `Bearer ${token}`);
    const assignAttempt = await request(app).post('/scale-entries/2026-06-22').set('Authorization', `Bearer ${opLogin.body.token}`).send({ creator_id: creator.id });
    const deleteAttempt = await request(app).delete(`/scale-entries/2026-06-22/${creator.id}`).set('Authorization', `Bearer ${opLogin.body.token}`);
    const autoAttempt = await request(app).post(`/scale-months/${list.body.scale_month_id}/auto-assign`).set('Authorization', `Bearer ${opLogin.body.token}`);

    expect(assignAttempt.status).toBe(403);
    expect(deleteAttempt.status).toBe(403);
    expect(autoAttempt.status).toBe(403);
  });

  it('GET/POST /holidays', async () => {
    const { token } = await loginAsGestor();
    const created = await request(app).post('/holidays').set('Authorization', `Bearer ${token}`).send({ holiday_date: '2026-06-15', description: 'Feriado local' });
    expect(created.status).toBe(201);

    const list = await request(app).get('/holidays?month=2026-06').set('Authorization', `Bearer ${token}`);
    expect(list.body.data).toHaveLength(1);
  });
});
