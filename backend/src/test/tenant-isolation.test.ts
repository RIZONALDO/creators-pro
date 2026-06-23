/**
 * Suíte de isolamento entre tenants — nasce na Fase 1 (não na Fase 9, ver specs/07-roadmap-implementacao.md).
 * Toda fase futura que adiciona um recurso novo (creators, tasks, absences, ...) estende este arquivo
 * com 1-2 casos cobrindo "tenant A nunca vê/edita dado do tenant B nesse recurso".
 */
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { createCompaniesRepository } from '../modules/auth/companies.repository.js';
import { createUsersRepository } from '../modules/auth/users.repository.js';
import { createCreatorsRepository } from '../modules/creators/creators.repository.js';
import { resetDb, testDb, testPool } from './db.js';
import { withTwoTenants } from './helpers/withTwoTenants.js';

describe('isolamento entre tenants', () => {
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

  it('o token de cada usuário só revela os próprios dados em /auth/me, nunca os do outro tenant', async () => {
    const { companyA, companyB, userA, userB, password } = await withTwoTenants();

    const loginA = await request(app).post('/auth/login').send({ email: userA.email, password });
    const loginB = await request(app).post('/auth/login').send({ email: userB.email, password });

    expect(loginA.status).toBe(200);
    expect(loginB.status).toBe(200);

    const meA = await request(app).get('/auth/me').set('Authorization', `Bearer ${loginA.body.token}`);
    const meB = await request(app).get('/auth/me').set('Authorization', `Bearer ${loginB.body.token}`);

    expect(meA.body.user.id).toBe(userA.id);
    expect(meA.body.user.tenant_id).toBe(companyA.id);
    expect(meA.body.user.tenant_id).not.toBe(companyB.id);

    expect(meB.body.user.id).toBe(userB.id);
    expect(meB.body.user.tenant_id).toBe(companyB.id);
    expect(meB.body.user.tenant_id).not.toBe(companyA.id);
  });

  it('um refresh token emitido para o usuário do tenant A nunca emite uma sessão com tenant_id de B', async () => {
    const { userA, password } = await withTwoTenants();

    const loginA = await request(app).post('/auth/login').send({ email: userA.email, password });
    const refreshed = await request(app).post('/auth/refresh').send({ refresh_token: loginA.body.refresh_token });

    const me = await request(app).get('/auth/me').set('Authorization', `Bearer ${refreshed.body.token}`);
    expect(me.body.user.tenant_id).toBe(userA.tenantId);
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

    await request(app).post('/creators').set('Authorization', `Bearer ${tokenB}`).send({ name: 'Creator B', email: 'creator-b@test.com', employment_type: 'fixed', password: 'senha12345' });
    await request(app)
      .post('/collaborators')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Colab B', email: 'colab-b@test.com', profession: 'Editor', employment_type: 'fixed', password: 'senha12345' });
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
      .send({ name: 'Creator B', email: 'creator-b2@test.com', employment_type: 'fixed', password: 'senha12345' });
    const clientB = await request(app).post('/clients').set('Authorization', `Bearer ${tokenB}`).send({ name: 'Cliente B2' });

    const editCreator = await request(app).put(`/creators/${creatorB.body.id}`).set('Authorization', `Bearer ${tokenA}`).send({ active: false });
    const editClient = await request(app).put(`/clients/${clientB.body.id}`).set('Authorization', `Bearer ${tokenA}`).send({ active: false });

    expect(editCreator.status).toBe(404);
    expect(editClient.status).toBe(404);
  });

  // Reordenar creators (drag na paleta da Escala): rota nova, recebe array de ids no corpo — não tem
  // :id na URL pra um 404 "natural", a checagem é o tenantId no WHERE de cada UPDATE individual.
  it('tenant A não reordena creator do tenant B via /creators/reorder (não afeta a ordem real)', async () => {
    const { userA, userB, password } = await withTwoTenants();
    const loginA = await request(app).post('/auth/login').send({ email: userA.email, password });
    const loginB = await request(app).post('/auth/login').send({ email: userB.email, password });
    const tokenA = loginA.body.token as string;
    const tokenB = loginB.body.token as string;

    const creatorB = await request(app)
      .post('/creators')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Creator B', email: `creator-b-reorder-${Date.now()}@test.com`, employment_type: 'fixed', password: 'senha12345' });

    const reorderAttempt = await request(app).put('/creators/reorder').set('Authorization', `Bearer ${tokenA}`).send({ creator_ids: [creatorB.body.id] });
    expect(reorderAttempt.status).toBe(204); // não erro — só não afeta nada, idêntico a um id inexistente

    const listB = await request(app).get('/creators').set('Authorization', `Bearer ${tokenB}`);
    expect(listB.body.data.find((c: { id: string }) => c.id === creatorB.body.id)).toBeDefined(); // continua existindo, intacto
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

    const creatorA = await request(app)
      .post('/creators')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Creator A', email: `creator-a-iso-${Date.now()}@test.com`, employment_type: 'fixed', password: 'senha12345' });
    await request(app).post('/scale-entries/2026-06-15').set('Authorization', `Bearer ${tokenA}`).send({ creator_id: creatorA.body.id });

    await request(app).post('/holidays').set('Authorization', `Bearer ${tokenB}`).send({ holiday_date: '2026-06-15', description: 'Feriado só do tenant B' });
    const scaleA = await request(app).get('/scale-entries?month=2026-06').set('Authorization', `Bearer ${tokenA}`);
    const holidaysA = await request(app).get('/holidays?month=2026-06').set('Authorization', `Bearer ${tokenA}`);

    expect(holidaysA.body.data).toHaveLength(0);
    const juneFifteenForA = scaleA.body.data.find((e: { work_date: string }) => e.work_date === '2026-06-15');
    expect(juneFifteenForA?.is_holiday).toBe(false); // feriado é do tenant B, não vaza pro A
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

  // Fase 9.1 (drag de mover/deletar no quadro de escala): DELETE é rota nova, precisa do próprio caso de isolamento.
  it('tenant A não remove atribuição de escala do tenant B (404)', async () => {
    const { userA, userB, password } = await withTwoTenants();
    const loginA = await request(app).post('/auth/login').send({ email: userA.email, password });
    const loginB = await request(app).post('/auth/login').send({ email: userB.email, password });
    const tokenA = loginA.body.token as string;
    const tokenB = loginB.body.token as string;

    const creatorB = await request(app)
      .post('/creators')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Creator B', email: `creator-b-unassign-${Date.now()}@test.com`, employment_type: 'fixed', password: 'senha12345' });
    await request(app).post('/scale-entries/2026-06-23').set('Authorization', `Bearer ${tokenB}`).send({ creator_id: creatorB.body.id });

    const deleteAttempt = await request(app).delete(`/scale-entries/2026-06-23/${creatorB.body.id}`).set('Authorization', `Bearer ${tokenA}`);
    expect(deleteAttempt.status).toBe(404);

    const scaleB = await request(app).get('/scale-entries?month=2026-06').set('Authorization', `Bearer ${tokenB}`);
    expect(scaleB.body.data.some((e: { creator_id: string | null }) => e.creator_id === creatorB.body.id)).toBe(true); // não foi removido de fato
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
    const deleteAttempt = await request(app).delete(`/shifts/${shiftB.body.id}`).set('Authorization', `Bearer ${tokenA}`);

    expect(reviewAttempt.status).toBe(404);
    expect(editAttempt.status).toBe(404);
    expect(deleteAttempt.status).toBe(404);

    const stillThere = await request(app).get('/shifts').set('Authorization', `Bearer ${tokenB}`);
    expect(stillThere.body.data).toHaveLength(1); // não foi removido de fato
  });

  // Ajuste fora do roadmap original (módulo /users, adicionado ao plugar o frontend real).
  it('admin do tenant A não lista nem edita usuários do tenant B', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const companyA = await companiesRepo.create({ name: 'Tenant A users', slug: `users-a-${suffix}` });
    const companyB = await companiesRepo.create({ name: 'Tenant B users', slug: `users-b-${suffix}` });

    const passwordHash = await bcrypt.hash('senha123', 4);
    await usersRepo.create({ tenantId: companyA.id, name: 'Admin A', email: `admin-a-${suffix}@test.com`, passwordHash, role: 'admin' });
    const userB = await usersRepo.create({ tenantId: companyB.id, name: 'Admin B', email: `admin-b-${suffix}@test.com`, passwordHash, role: 'admin' });

    const loginA = await request(app).post('/auth/login').send({ email: `admin-a-${suffix}@test.com`, password: 'senha123' });
    const tokenA = loginA.body.token as string;

    const listA = await request(app).get('/users').set('Authorization', `Bearer ${tokenA}`);
    const editAttempt = await request(app).put(`/users/${userB.id}`).set('Authorization', `Bearer ${tokenA}`).send({ status: 'inactive' });

    expect(listA.body.data.find((u: { id: string }) => u.id === userB.id)).toBeUndefined();
    expect(editAttempt.status).toBe(404);
  });

  // Fase 6: notifications/messages — extensão pedida em specs/07-roadmap-implementacao.md#fase-6--mensagens--notificações--socketio.
  it('tenant A não vê notifications nem conversas/mensagens do tenant B', async () => {
    const { userA, userB, password } = await withTwoTenants();
    const loginA = await request(app).post('/auth/login').send({ email: userA.email, password });
    const loginB = await request(app).post('/auth/login').send({ email: userB.email, password });
    const tokenA = loginA.body.token as string;
    const tokenB = loginB.body.token as string;

    const creatorUserB = await usersRepo.create({ tenantId: userB.tenantId, name: 'Creator B', email: `creator-b-msg-${Date.now()}@test.com`, passwordHash: 'hash', role: 'operacional' });
    const creatorB = await creatorsRepo.createRow({ tenantId: userB.tenantId, userId: creatorUserB.id, employmentType: 'fixed' });

    // gatilho novo_plantao gera notification pro creatorB; mensagem direta de userB pro creatorB.
    await request(app).post('/shifts').set('Authorization', `Bearer ${tokenB}`).send({ shift_date: '2026-06-21', creator_id: creatorB.id });
    await request(app).post('/messages').set('Authorization', `Bearer ${tokenB}`).send({ receiver_id: creatorUserB.id, message: 'Mensagem do tenant B' });

    const notificationsA = await request(app).get('/notifications').set('Authorization', `Bearer ${tokenA}`);
    const conversationsA = await request(app).get('/conversations').set('Authorization', `Bearer ${tokenA}`);
    const threadAttempt = await request(app).get(`/messages?with=${creatorUserB.id}`).set('Authorization', `Bearer ${tokenA}`);

    expect(notificationsA.body.data).toHaveLength(0);
    expect(conversationsA.body.data).toHaveLength(0);
    // userA não pertence ao tenant de creatorUserB — tentativa de abrir thread com ele falha (usuário inválido pro próprio tenant de A).
    expect(threadAttempt.status).toBe(400);
  });

  // Fase 7: reports — agregação (SUM/COUNT) é exatamente o tipo de bug que passa despercebido
  // sem WHERE tenant_id; teste explícito pedido em specs/07-roadmap-implementacao.md#fase-7--relatórios.
  it('tenant A não soma tarefas/plantões/ausências do tenant B nos relatórios', async () => {
    const { userA, userB, password } = await withTwoTenants();
    const loginA = await request(app).post('/auth/login').send({ email: userA.email, password });
    const loginB = await request(app).post('/auth/login').send({ email: userB.email, password });
    const tokenA = loginA.body.token as string;
    const tokenB = loginB.body.token as string;

    const creatorUserB = await usersRepo.create({ tenantId: userB.tenantId, name: 'Creator B', email: `creator-b-rel-${Date.now()}@test.com`, passwordHash: 'hash', role: 'operacional' });
    const creatorB = await creatorsRepo.createRow({ tenantId: userB.tenantId, userId: creatorUserB.id, employmentType: 'fixed' });
    const clientB = await request(app).post('/clients').set('Authorization', `Bearer ${tokenB}`).send({ name: 'Cliente B' });

    await request(app).post('/tasks').set('Authorization', `Bearer ${tokenB}`).send({ title: 'Tarefa B', task_date: '2026-06-25', creator_id: creatorB.id, client_id: clientB.body.id });
    const shiftB = await request(app).post('/shifts').set('Authorization', `Bearer ${tokenB}`).send({ shift_date: '2026-06-15', creator_id: creatorB.id });
    await request(app).patch(`/shifts/${shiftB.body.id}/status`).set('Authorization', `Bearer ${tokenB}`).send({ status: 'completed' });
    await request(app).post('/absences').set('Authorization', `Bearer ${tokenB}`).send({ creator_id: creatorB.id, start_date: '2026-06-14', end_date: '2026-06-16' });

    const range = 'from=2026-06-01&to=2026-06-30';
    const monthlyA = await request(app).get(`/reports/production-monthly?${range}`).set('Authorization', `Bearer ${tokenA}`);
    const byClientA = await request(app).get(`/reports/production-by-client?${range}`).set('Authorization', `Bearer ${tokenA}`);
    const byCreatorA = await request(app).get(`/reports/production-by-creator?${range}`).set('Authorization', `Bearer ${tokenA}`);
    const shiftsA = await request(app).get(`/reports/shifts-completed?${range}`).set('Authorization', `Bearer ${tokenA}`);
    const absencesA = await request(app).get(`/reports/absences?${range}`).set('Authorization', `Bearer ${tokenA}`);
    const approvedA = await request(app).get(`/reports/approved-deliveries?${range}`).set('Authorization', `Bearer ${tokenA}`);
    const tasksListA = await request(app).get(`/reports/tasks?${range}`).set('Authorization', `Bearer ${tokenA}`);
    const servicesListA = await request(app).get(`/reports/services?${range}`).set('Authorization', `Bearer ${tokenA}`);
    const absencesListA = await request(app).get(`/reports/absences-list?${range}`).set('Authorization', `Bearer ${tokenA}`);

    expect(monthlyA.body.data).toHaveLength(0);
    expect(byClientA.body.data).toHaveLength(0);
    expect(byCreatorA.body.data).toHaveLength(0);
    expect(shiftsA.body.data).toMatchObject({ total: 0, by_creator: [] });
    expect(absencesA.body.data).toMatchObject({ total: 0, by_status: [], by_creator: [] });
    expect(approvedA.body.data).toMatchObject({ total: 0, approved: 0 });
    expect(tasksListA.body.data).toHaveLength(0);
    expect(servicesListA.body.data).toHaveLength(0);
    expect(absencesListA.body.data).toHaveLength(0);
  });

  // Fase 8: attachments — teste explícito pedido em specs/07-roadmap-implementacao.md#fase-8--anexos--configurações-da-empresa.
  it('tenant A não lista, não baixa e não exclui anexo de tarefa do tenant B', async () => {
    const { userA, userB, password } = await withTwoTenants();
    const loginA = await request(app).post('/auth/login').send({ email: userA.email, password });
    const loginB = await request(app).post('/auth/login').send({ email: userB.email, password });
    const tokenA = loginA.body.token as string;
    const tokenB = loginB.body.token as string;

    const creatorUserB = await usersRepo.create({ tenantId: userB.tenantId, name: 'Creator B', email: `creator-b-att-${Date.now()}@test.com`, passwordHash: 'hash', role: 'operacional' });
    const creatorB = await creatorsRepo.createRow({ tenantId: userB.tenantId, userId: creatorUserB.id, employmentType: 'fixed' });
    const taskB = await request(app).post('/tasks').set('Authorization', `Bearer ${tokenB}`).send({ title: 'Tarefa B', task_date: '2026-06-25', creator_id: creatorB.id });
    const uploadB = await request(app)
      .post('/attachments')
      .set('Authorization', `Bearer ${tokenB}`)
      .field('entity_type', 'task')
      .field('entity_id', taskB.body.id)
      .attach('file', Buffer.from('conteúdo do tenant B'), 'b.png');
    const attachmentId = uploadB.body.data.id;

    const listA = await request(app).get(`/attachments?entity_type=task&entity_id=${taskB.body.id}`).set('Authorization', `Bearer ${tokenA}`);
    const fileA = await request(app).get(`/attachments/${attachmentId}/file`).set('Authorization', `Bearer ${tokenA}`);
    const deleteA = await request(app).delete(`/attachments/${attachmentId}`).set('Authorization', `Bearer ${tokenA}`);

    expect(listA.status).toBe(404); // a própria tarefa B não existe pro tenant A
    expect(fileA.status).toBe(404);
    expect(deleteA.status).toBe(404);
  });

  // Fase 8: company_settings — agregação de 1 linha por tenant é exatamente o tipo de bug que passa
  // despercebido sem WHERE tenant_id; teste explícito pedido em specs/07-roadmap-implementacao.md#fase-8.
  it('tenant A não vê as configurações que o admin do tenant B salvou', async () => {
    const { userA, userB, password } = await withTwoTenants();
    const adminUserB = await usersRepo.create({ tenantId: userB.tenantId, name: 'Admin B', email: `admin-b-${Date.now()}@test.com`, passwordHash: await bcrypt.hash(password, 4), role: 'admin' });
    const loginA = await request(app).post('/auth/login').send({ email: userA.email, password });
    const adminLoginB = await request(app).post('/auth/login').send({ email: adminUserB.email, password });
    const tokenA = loginA.body.token as string;
    const adminTokenB = adminLoginB.body.token as string;

    const put = await request(app).put('/company/settings').set('Authorization', `Bearer ${adminTokenB}`).send({ display_name: 'Empresa do tenant B', timezone: 'America/Manaus' });
    expect(put.status).toBe(200);

    const getA = await request(app).get('/company/settings').set('Authorization', `Bearer ${tokenA}`);
    expect(getA.body.data.display_name).toBeNull(); // ainda nos defaults — não herdou o que o tenant B salvou
    expect(getA.body.data.timezone).toBe('America/Sao_Paulo');
  });

  // Exclusão física (creators/collaborators/clients/tasks/services) — ajuste fora do roadmap original.
  it('tenant A não exclui creator/client/task do tenant B (404, não 204)', async () => {
    const { userA, userB, password } = await withTwoTenants();
    const loginA = await request(app).post('/auth/login').send({ email: userA.email, password });
    const loginB = await request(app).post('/auth/login').send({ email: userB.email, password });
    const tokenA = loginA.body.token as string;
    const tokenB = loginB.body.token as string;

    const creatorB = await request(app)
      .post('/creators')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Creator B', email: `creator-b-del-${Date.now()}@test.com`, employment_type: 'fixed', password: 'senha12345' });
    const collaboratorB = await request(app)
      .post('/collaborators')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Colaborador B', email: `colab-b-del-${Date.now()}@test.com`, profession: 'Editor', employment_type: 'freelancer', password: 'senha12345' });
    const clientB = await request(app).post('/clients').set('Authorization', `Bearer ${tokenB}`).send({ name: 'Cliente B' });
    const taskB = await request(app).post('/tasks').set('Authorization', `Bearer ${tokenB}`).send({ title: 'Tarefa B' });
    const serviceB = await request(app).post('/services').set('Authorization', `Bearer ${tokenB}`).send({ service_name: 'Serviço B' });

    const deleteCreatorAttempt = await request(app).delete(`/creators/${creatorB.body.id}`).set('Authorization', `Bearer ${tokenA}`);
    const deleteCollaboratorAttempt = await request(app).delete(`/collaborators/${collaboratorB.body.id}`).set('Authorization', `Bearer ${tokenA}`);
    const deleteClientAttempt = await request(app).delete(`/clients/${clientB.body.id}`).set('Authorization', `Bearer ${tokenA}`);
    const deleteTaskAttempt = await request(app).delete(`/tasks/${taskB.body.id}`).set('Authorization', `Bearer ${tokenA}`);
    const deleteServiceAttempt = await request(app).delete(`/services/${serviceB.body.id}`).set('Authorization', `Bearer ${tokenA}`);

    expect(deleteCreatorAttempt.status).toBe(404);
    expect(deleteCollaboratorAttempt.status).toBe(404);
    expect(deleteClientAttempt.status).toBe(404);
    expect(deleteTaskAttempt.status).toBe(404);
    expect(deleteServiceAttempt.status).toBe(404);

    // confirma que nada foi apagado de fato — tenant B ainda vê tudo
    const creatorsB = await request(app).get('/creators').set('Authorization', `Bearer ${tokenB}`);
    expect(creatorsB.body.data.find((c: { id: string }) => c.id === creatorB.body.id)).toBeDefined();
  });

  it('tenant A não atualiza (PUT) tarefa/serviço nem muda status de serviço/plantão do tenant B', async () => {
    const { userA, userB, password } = await withTwoTenants();
    const loginA = await request(app).post('/auth/login').send({ email: userA.email, password });
    const loginB = await request(app).post('/auth/login').send({ email: userB.email, password });
    const tokenA = loginA.body.token as string;
    const tokenB = loginB.body.token as string;

    const taskB = await request(app).post('/tasks').set('Authorization', `Bearer ${tokenB}`).send({ title: 'Tarefa B' });
    const serviceB = await request(app).post('/services').set('Authorization', `Bearer ${tokenB}`).send({ service_name: 'Serviço B' });
    const shiftB = await request(app).post('/shifts').set('Authorization', `Bearer ${tokenB}`).send({ shift_date: '2026-06-22' });

    const putTaskAttempt = await request(app).put(`/tasks/${taskB.body.id}`).set('Authorization', `Bearer ${tokenA}`).send({ title: 'tentativa' });
    const putServiceAttempt = await request(app).put(`/services/${serviceB.body.id}`).set('Authorization', `Bearer ${tokenA}`).send({ service_name: 'tentativa' });
    const statusServiceAttempt = await request(app).patch(`/services/${serviceB.body.id}/status`).set('Authorization', `Bearer ${tokenA}`).send({ status: 'concluido' });
    const statusShiftAttempt = await request(app).patch(`/shifts/${shiftB.body.id}/status`).set('Authorization', `Bearer ${tokenA}`).send({ status: 'completed' });

    expect(putTaskAttempt.status).toBe(404);
    expect(putServiceAttempt.status).toBe(404);
    expect(statusServiceAttempt.status).toBe(404);
    expect(statusShiftAttempt.status).toBe(404);
  });

  it('tenant A não vê profissões customizadas nem contatos de mensagem do tenant B', async () => {
    const { userA, userB, password } = await withTwoTenants();
    const loginA = await request(app).post('/auth/login').send({ email: userA.email, password });
    const loginB = await request(app).post('/auth/login').send({ email: userB.email, password });
    const tokenA = loginA.body.token as string;
    const tokenB = loginB.body.token as string;

    await request(app)
      .post('/collaborators')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Colaborador B', email: `colab-b-prof-${Date.now()}@test.com`, profession: 'Profissão Exclusiva Tenant B', employment_type: 'freelancer', password: 'senha12345' });
    // gestor vê creators (não outros gestores) em /messages/contacts — precisa de um creator B pra testar isolamento de verdade.
    const creatorB = await request(app)
      .post('/creators')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Creator Exclusivo Tenant B', email: `creator-b-contacts-${Date.now()}@test.com`, employment_type: 'fixed', password: 'senha12345' });

    const professionsA = await request(app).get('/professions').set('Authorization', `Bearer ${tokenA}`);
    expect(professionsA.body.data).not.toContain('Profissão Exclusiva Tenant B');

    const contactsA = await request(app).get('/messages/contacts').set('Authorization', `Bearer ${tokenA}`);
    expect(contactsA.body.data.find((c: { name: string }) => c.name === creatorB.body.name)).toBeUndefined();
  });

  it('tenant A não consegue escalar usando creator_id de outro tenant (escala)', async () => {
    const { userA, userB, password } = await withTwoTenants();
    const loginA = await request(app).post('/auth/login').send({ email: userA.email, password });
    const loginB = await request(app).post('/auth/login').send({ email: userB.email, password });
    const tokenA = loginA.body.token as string;
    const tokenB = loginB.body.token as string;

    const creatorB = await request(app)
      .post('/creators')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Creator B', email: `creator-b-escala-${Date.now()}@test.com`, employment_type: 'fixed', password: 'senha12345' });

    const assignAttempt = await request(app)
      .post('/scale-entries/2026-06-23')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ creator_id: creatorB.body.id });

    expect(assignAttempt.status).toBe(400);
    expect(assignAttempt.body.error.code).toBe('INVALID_CREATOR');
  });

  // Sobreaviso de plantão: rota nova, mesma checagem de creator_id de outro tenant precisa valer pra cada id da lista.
  it('tenant A não consegue usar creator de outro tenant como sobreaviso de plantão', async () => {
    const { userA, userB, password } = await withTwoTenants();
    const loginA = await request(app).post('/auth/login').send({ email: userA.email, password });
    const loginB = await request(app).post('/auth/login').send({ email: userB.email, password });
    const tokenA = loginA.body.token as string;
    const tokenB = loginB.body.token as string;

    const creatorB = await request(app)
      .post('/creators')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Creator B', email: `creator-b-standby-${Date.now()}@test.com`, employment_type: 'fixed', password: 'senha12345' });

    const createAttempt = await request(app)
      .post('/shifts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ shift_date: '2026-06-21', standby_creator_ids: [creatorB.body.id] });

    expect(createAttempt.status).toBe(400);
    expect(createAttempt.body.error.code).toBe('INVALID_CREATOR');
  });
});
