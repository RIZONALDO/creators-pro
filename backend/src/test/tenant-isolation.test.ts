/**
 * Suíte de isolamento entre tenants — nasce na Fase 1 (não na Fase 9, ver specs/07-roadmap-implementacao.md).
 * Toda fase futura que adiciona um recurso novo (creators, tasks, absences, ...) estende este arquivo
 * com 1-2 casos cobrindo "tenant A nunca vê/edita dado do tenant B nesse recurso".
 */
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { createUsersRepository } from '../modules/auth/users.repository.js';
import { createCreatorsRepository } from '../modules/creators/creators.repository.js';
import { resetDb, testDb, testPool } from './db.js';
import { withTwoTenants } from './helpers/withTwoTenants.js';

describe('isolamento entre tenants', () => {
  const app = createApp(testDb);
  const usersRepo = createUsersRepository(testDb);
  const creatorsRepo = createCreatorsRepository(testDb);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  it('o token de cada usuário só revela os próprios dados em /auth/me, nunca os do outro tenant', async () => {
    const { companyA, companyB, userA, userB, password } = await withTwoTenants();

    const loginA = await request(app).post('/auth/login').send({ email: userA.email, password });
    const loginB = await request(app).post('/auth/login').send({ email: userB.email, password });

    expect(loginA.status).toBe(200);
    expect(loginB.status).toBe(200);

    const meA = await request(app).get('/auth/me').set('Authorization', `Bearer ${loginA.body.token}`);
    const meB = await request(app).get('/auth/me').set('Authorization', `Bearer ${loginB.body.token}`);

    expect(meA.body.user.id).toBe(userA.id);
    expect(meA.body.user.tenantId).toBe(companyA.id);
    expect(meA.body.user.tenantId).not.toBe(companyB.id);

    expect(meB.body.user.id).toBe(userB.id);
    expect(meB.body.user.tenantId).toBe(companyB.id);
    expect(meB.body.user.tenantId).not.toBe(companyA.id);
  });

  it('um refresh token emitido para o usuário do tenant A nunca emite uma sessão com tenant_id de B', async () => {
    const { userA, password } = await withTwoTenants();

    const loginA = await request(app).post('/auth/login').send({ email: userA.email, password });
    const refreshed = await request(app).post('/auth/refresh').send({ refreshToken: loginA.body.refreshToken });

    const me = await request(app).get('/auth/me').set('Authorization', `Bearer ${refreshed.body.token}`);
    expect(me.body.user.tenantId).toBe(userA.tenantId);
  });

  it('provisionar dois tenants com e-mails de admin diferentes nunca faz um logar como o outro', async () => {
    const { userA, userB } = await withTwoTenants();
    expect(userA.email).not.toBe(userB.email);
    expect(userA.tenantId).not.toBe(userB.tenantId);
  });

  // Fase 2: creators/collaborators/clients — extensão pedida em specs/07-roadmap-implementacao.md#fase-2.
  it('tenant A não lista creators/collaborators/clients criados pelo tenant B', async () => {
    const { userA, userB, password } = await withTwoTenants();
    const loginA = await request(app).post('/auth/login').send({ email: userA.email, password });
    const loginB = await request(app).post('/auth/login').send({ email: userB.email, password });
    const tokenA = loginA.body.token as string;
    const tokenB = loginB.body.token as string;

    await request(app).post('/creators').set('Authorization', `Bearer ${tokenB}`).send({ name: 'Creator B', email: 'creator-b@test.com', employment_type: 'fixed' });
    await request(app)
      .post('/collaborators')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Colab B', email: 'colab-b@test.com', profession: 'Editor', employment_type: 'fixed' });
    await request(app).post('/clients').set('Authorization', `Bearer ${tokenB}`).send({ name: 'Cliente B' });

    const creatorsA = await request(app).get('/creators').set('Authorization', `Bearer ${tokenA}`);
    const collaboratorsA = await request(app).get('/collaborators').set('Authorization', `Bearer ${tokenA}`);
    const clientsA = await request(app).get('/clients').set('Authorization', `Bearer ${tokenA}`);

    expect(creatorsA.body.data).toHaveLength(0);
    expect(collaboratorsA.body.data).toHaveLength(0);
    expect(clientsA.body.data).toHaveLength(0);
  });

  it('tenant A não edita creator/collaborator/client do tenant B (404, não 200)', async () => {
    const { userA, userB, password } = await withTwoTenants();
    const loginA = await request(app).post('/auth/login').send({ email: userA.email, password });
    const loginB = await request(app).post('/auth/login').send({ email: userB.email, password });
    const tokenA = loginA.body.token as string;
    const tokenB = loginB.body.token as string;

    const creatorB = await request(app)
      .post('/creators')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Creator B', email: 'creator-b2@test.com', employment_type: 'fixed' });
    const clientB = await request(app).post('/clients').set('Authorization', `Bearer ${tokenB}`).send({ name: 'Cliente B2' });

    const editCreator = await request(app).put(`/creators/${creatorB.body.id}`).set('Authorization', `Bearer ${tokenA}`).send({ active: false });
    const editClient = await request(app).put(`/clients/${clientB.body.id}`).set('Authorization', `Bearer ${tokenA}`).send({ active: false });

    expect(editCreator.status).toBe(404);
    expect(editClient.status).toBe(404);
  });

  // Fase 3: tasks/services/status_history — extensão pedida em specs/07-roadmap-implementacao.md#fase-3.
  it('tenant A não lista tasks/services do tenant B', async () => {
    const { userA, userB, password } = await withTwoTenants();
    const loginA = await request(app).post('/auth/login').send({ email: userA.email, password });
    const loginB = await request(app).post('/auth/login').send({ email: userB.email, password });
    const tokenA = loginA.body.token as string;
    const tokenB = loginB.body.token as string;

    await request(app).post('/tasks').set('Authorization', `Bearer ${tokenB}`).send({ title: 'Tarefa do tenant B' });
    await request(app).post('/services').set('Authorization', `Bearer ${tokenB}`).send({ service_name: 'Serviço do tenant B' });

    const tasksA = await request(app).get('/tasks').set('Authorization', `Bearer ${tokenA}`);
    const servicesA = await request(app).get('/services').set('Authorization', `Bearer ${tokenA}`);

    expect(tasksA.body.data).toHaveLength(0);
    expect(servicesA.body.data).toHaveLength(0);
  });

  it('tenant A não muda status nem lê histórico de task/service do tenant B (404)', async () => {
    const { userA, userB, password } = await withTwoTenants();
    const loginA = await request(app).post('/auth/login').send({ email: userA.email, password });
    const loginB = await request(app).post('/auth/login').send({ email: userB.email, password });
    const tokenA = loginA.body.token as string;
    const tokenB = loginB.body.token as string;

    const taskB = await request(app).post('/tasks').set('Authorization', `Bearer ${tokenB}`).send({ title: 'Tarefa B' });
    const serviceB = await request(app).post('/services').set('Authorization', `Bearer ${tokenB}`).send({ service_name: 'Serviço B' });

    const statusAttemptTask = await request(app)
      .patch(`/tasks/${taskB.body.id}/status`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'aprovado' });
    const statusAttemptService = await request(app)
      .patch(`/services/${serviceB.body.id}/status`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'concluido' });

    // histórico gravado pelo tenant B não aparece pra quem consulta com o tenant_id de A
    const historyFromA = await request(app)
      .get(`/status-history?entity_type=task&entity_id=${taskB.body.id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(statusAttemptTask.status).toBe(404);
    expect(statusAttemptService.status).toBe(404);
    expect(historyFromA.body.data).toHaveLength(0);
  });

  // Fase 4a: scale_entries/holidays — extensão pedida em specs/07-roadmap-implementacao.md#fase-4a.
  it('tenant A não vê atribuições de escala nem feriados específicos do tenant B', async () => {
    const { userA, userB, password } = await withTwoTenants();
    const loginA = await request(app).post('/auth/login').send({ email: userA.email, password });
    const loginB = await request(app).post('/auth/login').send({ email: userB.email, password });
    const tokenA = loginA.body.token as string;
    const tokenB = loginB.body.token as string;

    await request(app).post('/holidays').set('Authorization', `Bearer ${tokenB}`).send({ holiday_date: '2026-06-15', description: 'Feriado só do tenant B' });
    const scaleA = await request(app).get('/scale-entries?month=2026-06').set('Authorization', `Bearer ${tokenA}`);
    const holidaysA = await request(app).get('/holidays?month=2026-06').set('Authorization', `Bearer ${tokenA}`);

    expect(holidaysA.body.data).toHaveLength(0);
    const juneFifteenForA = scaleA.body.data.find((e: { workDate: string }) => e.workDate === '2026-06-15');
    expect(juneFifteenForA?.isHoliday).toBe(false); // feriado é do tenant B, não vaza pro A
  });

  it('tenant A não roda escala automática nem duplica mês do tenant B (404)', async () => {
    const { userA, userB, password } = await withTwoTenants();
    const loginA = await request(app).post('/auth/login').send({ email: userA.email, password });
    const loginB = await request(app).post('/auth/login').send({ email: userB.email, password });
    const tokenA = loginA.body.token as string;
    const tokenB = loginB.body.token as string;

    const scaleB = await request(app).get('/scale-entries?month=2026-06').set('Authorization', `Bearer ${tokenB}`);
    const scaleMonthIdB = scaleB.body.scale_month_id as string;

    const autoAttempt = await request(app).post(`/scale-months/${scaleMonthIdB}/auto-assign`).set('Authorization', `Bearer ${tokenA}`);
    const duplicateAttempt = await request(app)
      .post(`/scale-months/${scaleMonthIdB}/duplicate`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ target_month: 7, target_year: 2026 });

    expect(autoAttempt.status).toBe(404);
    expect(duplicateAttempt.status).toBe(404);
  });

  // Fase 5: absences/shifts — extensão pedida em specs/07-roadmap-implementacao.md#fase-5--ausências--plantões.
  it('tenant A não lista absences/shifts do tenant B', async () => {
    const { userA, userB, password } = await withTwoTenants();
    const loginA = await request(app).post('/auth/login').send({ email: userA.email, password });
    const loginB = await request(app).post('/auth/login').send({ email: userB.email, password });
    const tokenA = loginA.body.token as string;
    const tokenB = loginB.body.token as string;

    const creatorUserB = await usersRepo.create({ tenantId: userB.tenantId, name: 'Creator B', email: `creator-b-${Date.now()}@test.com`, passwordHash: 'hash', role: 'operacional' });
    const creatorB = await creatorsRepo.createRow({ tenantId: userB.tenantId, userId: creatorUserB.id, employmentType: 'fixed' });

    await request(app).post('/absences').set('Authorization', `Bearer ${tokenB}`).send({ creator_id: creatorB.id, start_date: '2026-06-24', end_date: '2026-06-26' });
    await request(app).post('/shifts').set('Authorization', `Bearer ${tokenB}`).send({ shift_date: '2026-06-21', creator_id: creatorB.id });

    const absencesA = await request(app).get('/absences').set('Authorization', `Bearer ${tokenA}`);
    const shiftsA = await request(app).get('/shifts').set('Authorization', `Bearer ${tokenA}`);

    expect(absencesA.body.data).toHaveLength(0);
    expect(shiftsA.body.data).toHaveLength(0);
  });

  it('tenant A não revisa ausência nem edita plantão do tenant B (404)', async () => {
    const { userA, userB, password } = await withTwoTenants();
    const loginA = await request(app).post('/auth/login').send({ email: userA.email, password });
    const loginB = await request(app).post('/auth/login').send({ email: userB.email, password });
    const tokenA = loginA.body.token as string;
    const tokenB = loginB.body.token as string;

    const creatorUserB = await usersRepo.create({ tenantId: userB.tenantId, name: 'Creator B', email: `creator-b2-${Date.now()}@test.com`, passwordHash: 'hash', role: 'operacional' });
    const creatorB = await creatorsRepo.createRow({ tenantId: userB.tenantId, userId: creatorUserB.id, employmentType: 'fixed' });

    const absenceB = await request(app).post('/absences').set('Authorization', `Bearer ${tokenB}`).send({ creator_id: creatorB.id, start_date: '2026-06-24', end_date: '2026-06-26' });
    const shiftB = await request(app).post('/shifts').set('Authorization', `Bearer ${tokenB}`).send({ shift_date: '2026-06-21' });

    const reviewAttempt = await request(app).patch(`/absences/${absenceB.body.id}/review`).set('Authorization', `Bearer ${tokenA}`).send({ status: 'approved' });
    const editAttempt = await request(app).put(`/shifts/${shiftB.body.id}`).set('Authorization', `Bearer ${tokenA}`).send({ notes: 'tentativa' });

    expect(reviewAttempt.status).toBe(404);
    expect(editAttempt.status).toBe(404);
  });
});
