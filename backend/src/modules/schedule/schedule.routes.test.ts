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

  it('GET /scale-entries cria as linhas do mês na primeira chamada', async () => {
    const { token } = await loginAsGestor();
    const res = await request(app).get('/scale-entries?month=2026-06').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(22);
    expect(res.body.scale_month_id).toBeDefined();
  });

  it('PUT /scale-entries/:work_date atribui um creator', async () => {
    const { company, token } = await loginAsGestor();
    const creatorUser = await usersRepo.create({ tenantId: company.id, name: 'Creator', email: 'creator@acme.com', passwordHash: await bcrypt.hash('x', 4), role: 'operacional' });
    const creator = await creatorsRepo.createRow({ tenantId: company.id, userId: creatorUser.id, employmentType: 'fixed' });

    const res = await request(app).put('/scale-entries/2026-06-22').set('Authorization', `Bearer ${token}`).send({ creator_id: creator.id });

    expect(res.status).toBe(200);
    expect(res.body.creatorId).toBe(creator.id);
  });

  it('PUT /scale-entries/:work_date com ausência aprovada cobrindo a data retorna 409', async () => {
    const { company, token } = await loginAsGestor();
    const creatorUser = await usersRepo.create({ tenantId: company.id, name: 'Creator', email: 'creator2@acme.com', passwordHash: await bcrypt.hash('x', 4), role: 'operacional' });
    const creator = await creatorsRepo.createRow({ tenantId: company.id, userId: creatorUser.id, employmentType: 'fixed' });
    const absence = await absencesRepo.create({ tenantId: company.id, creatorId: creator.id, startDate: '2026-06-24', endDate: '2026-06-26' });
    await absencesRepo.review(company.id, absence.id, 'approved', creatorUser.id);

    const res = await request(app).put('/scale-entries/2026-06-25').set('Authorization', `Bearer ${token}`).send({ creator_id: creator.id });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ABSENCE_OVERLAPS_SCHEDULE');
  });

  it('PUT /scale-entries/:work_date em fim de semana retorna 400', async () => {
    const { token } = await loginAsGestor();
    const res = await request(app).put('/scale-entries/2026-06-20').set('Authorization', `Bearer ${token}`).send({ creator_id: null });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_WORK_DATE');
  });

  it('POST /scale-months/:id/auto-assign distribui round-robin', async () => {
    const { company, token } = await loginAsGestor();
    for (let i = 0; i < 2; i++) {
      const user = await usersRepo.create({ tenantId: company.id, name: `Creator ${i}`, email: `creator${i}@acme.com`, passwordHash: await bcrypt.hash('x', 4), role: 'operacional' });
      await creatorsRepo.createRow({ tenantId: company.id, userId: user.id, employmentType: 'fixed' });
    }

    const list = await request(app).get('/scale-entries?month=2026-06').set('Authorization', `Bearer ${token}`);
    const auto = await request(app).post(`/scale-months/${list.body.scale_month_id}/auto-assign`).set('Authorization', `Bearer ${token}`);

    expect(auto.status).toBe(200);
    expect(auto.body.data.filter((e: { creatorId: string | null }) => e.creatorId !== null)).toHaveLength(22);
  });

  it('operacional recebe 403 ao tentar atribuir ou rodar escala automática', async () => {
    const { company, token } = await loginAsGestor();
    const passwordHash = await bcrypt.hash('senha123', 4);
    await usersRepo.create({ tenantId: company.id, name: 'Op', email: 'op@acme.com', passwordHash, role: 'operacional' });
    const opLogin = await request(app).post('/auth/login').send({ email: 'op@acme.com', password: 'senha123' });

    const list = await request(app).get('/scale-entries?month=2026-06').set('Authorization', `Bearer ${token}`);
    const assignAttempt = await request(app).put('/scale-entries/2026-06-22').set('Authorization', `Bearer ${opLogin.body.token}`).send({ creator_id: null });
    const autoAttempt = await request(app).post(`/scale-months/${list.body.scale_month_id}/auto-assign`).set('Authorization', `Bearer ${opLogin.body.token}`);

    expect(assignAttempt.status).toBe(403);
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
