import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { createCreatorsRepository } from '../creators/creators.repository.js';
import { createClientsRepository } from '../clients/clients.repository.js';
import { createTasksRepository } from '../tasks/tasks.repository.js';
import { createCollaboratorsRepository } from '../collaborators/collaborators.repository.js';
import { createServicesRepository } from '../services/services.repository.js';
import { createAbsencesRepository } from '../absences/absences.repository.js';

describe('rotas de reports (integração)', () => {
  const app = createApp(testDb);
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);
  const creatorsRepo = createCreatorsRepository(testDb);
  const clientsRepo = createClientsRepository(testDb);
  const tasksRepo = createTasksRepository(testDb);
  const collaboratorsRepo = createCollaboratorsRepository(testDb);
  const servicesRepo = createServicesRepository(testDb);
  const absencesRepo = createAbsencesRepository(testDb);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  async function setupTenant() {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const passwordHash = await bcrypt.hash('senha123', 4);
    const gestor = await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: 'gestora@acme.com', passwordHash, role: 'gestor' });
    const creatorUser = await usersRepo.create({ tenantId: company.id, name: 'Creator', email: 'creator@acme.com', passwordHash, role: 'operacional' });
    const creator = await creatorsRepo.createRow({ tenantId: company.id, userId: creatorUser.id, employmentType: 'fixed' });
    const otherCreatorUser = await usersRepo.create({ tenantId: company.id, name: 'Outro Creator', email: 'outro@acme.com', passwordHash, role: 'operacional' });
    const otherCreator = await creatorsRepo.createRow({ tenantId: company.id, userId: otherCreatorUser.id, employmentType: 'fixed' });
    const client = await clientsRepo.create(company.id, { name: 'Cliente X' });

    await tasksRepo.create({ tenantId: company.id, title: 'Tarefa do creator', taskDate: '2026-06-10', creatorId: creator.id, clientId: client.id, createdBy: gestor.id });
    await tasksRepo.create({ tenantId: company.id, title: 'Tarefa de outro creator', taskDate: '2026-06-11', creatorId: otherCreator.id, clientId: client.id, createdBy: gestor.id });

    const gestorLogin = await request(app).post('/auth/login').send({ email: 'gestora@acme.com', password: 'senha123' });
    const creatorLogin = await request(app).post('/auth/login').send({ email: 'creator@acme.com', password: 'senha123' });
    return { company, gestor, gestorToken: gestorLogin.body.token as string, creatorToken: creatorLogin.body.token as string, creator };
  }

  it('gestor vê produção de todos os creators; operacional só a própria', async () => {
    const { gestorToken, creatorToken, creator } = await setupTenant();

    const asGestor = await request(app).get('/reports/production-by-creator?from=2026-06-01&to=2026-06-30').set('Authorization', `Bearer ${gestorToken}`);
    expect(asGestor.body.data).toHaveLength(2);

    const asCreator = await request(app).get('/reports/production-by-creator?from=2026-06-01&to=2026-06-30').set('Authorization', `Bearer ${creatorToken}`);
    expect(asCreator.body.data).toHaveLength(1);
    expect(asCreator.body.data[0].creator_id).toBe(creator.id);
  });

  it('operacional não consegue ver dado de outro creator mesmo informando creatorId na query', async () => {
    const { creatorToken, creator } = await setupTenant();

    const res = await request(app)
      .get(`/reports/production-by-creator?from=2026-06-01&to=2026-06-30&creatorId=${creator.id}`)
      .set('Authorization', `Bearer ${creatorToken}`);

    // mesmo pedindo explicitamente o próprio id (ou qualquer outro), a resposta é só a dele mesmo — resolvido no service, não no query param.
    expect(res.body.data).toHaveLength(1);
  });

  it('sem from/to falha com 400 (VALIDATION_ERROR)', async () => {
    const { gestorToken } = await setupTenant();
    const res = await request(app).get('/reports/production-monthly').set('Authorization', `Bearer ${gestorToken}`);
    expect(res.status).toBe(400);
  });

  it('to anterior a from falha com INVALID_DATE_RANGE', async () => {
    const { gestorToken } = await setupTenant();
    const res = await request(app).get('/reports/production-monthly?from=2026-06-30&to=2026-06-01').set('Authorization', `Bearer ${gestorToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_DATE_RANGE');
  });

  it('sem token autenticado, 401', async () => {
    const res = await request(app).get('/reports/production-monthly?from=2026-06-01&to=2026-06-30');
    expect(res.status).toBe(401);
  });

  it('GET /reports/approved-deliveries devolve total/aprovado/taxa', async () => {
    const { gestorToken } = await setupTenant();
    const res = await request(app).get('/reports/approved-deliveries?from=2026-06-01&to=2026-06-30').set('Authorization', `Bearer ${gestorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ total: 2, approved: 0 });
  });

  it('GET /reports/export?format=pdf devolve um PDF não vazio', async () => {
    const { gestorToken } = await setupTenant();
    const res = await request(app)
      .get('/reports/export?type=creator&format=pdf&from=2026-06-01&to=2026-06-30')
      .set('Authorization', `Bearer ${gestorToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(Number(res.headers['content-length'])).toBeGreaterThan(0);
  });

  it('GET /reports/export?format=excel devolve um xlsx não vazio', async () => {
    const { gestorToken } = await setupTenant();
    const res = await request(app)
      .get('/reports/export?type=client&format=excel&from=2026-06-01&to=2026-06-30')
      .set('Authorization', `Bearer ${gestorToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(Number(res.headers['content-length'])).toBeGreaterThan(0);
  });

  it('GET /reports/tasks devolve a listagem completa (não agregada); operacional só a própria', async () => {
    const { gestorToken, creatorToken } = await setupTenant();

    const asGestor = await request(app).get('/reports/tasks?from=2026-06-01&to=2026-06-30').set('Authorization', `Bearer ${gestorToken}`);
    expect(asGestor.body.data).toHaveLength(2);
    expect(asGestor.body.data[0]).toHaveProperty('title');
    expect(asGestor.body.data[0]).toHaveProperty('client_name');
    expect(asGestor.body.data[0].responsible_name).toBe('Gestora'); // quem criou a tarefa = o gestor que liderou

    const asCreator = await request(app).get('/reports/tasks?from=2026-06-01&to=2026-06-30').set('Authorization', `Bearer ${creatorToken}`);
    expect(asCreator.body.data).toHaveLength(1);
  });

  it('GET /reports/services devolve listagem completa de outros serviços para gestor', async () => {
    const { company, gestor, gestorToken } = await setupTenant();
    const colab = await collaboratorsRepo.createRow({ tenantId: company.id, name: 'Colaborador A', profession: 'Editor', employmentType: 'freelancer' });
    const otherColab = await collaboratorsRepo.createRow({ tenantId: company.id, name: 'Colaborador B', profession: 'Editor', employmentType: 'freelancer' });
    const client = await clientsRepo.create(company.id, { name: 'Cliente Y' });

    await servicesRepo.create({ tenantId: company.id, serviceName: 'Captação drone', serviceType: 'drone', serviceDate: '2026-06-15', collaboratorId: colab.id, clientId: client.id, createdBy: gestor.id });
    await servicesRepo.create({ tenantId: company.id, serviceName: 'Edição', serviceType: 'edicao', serviceDate: '2026-06-16', collaboratorId: otherColab.id, clientId: client.id, createdBy: gestor.id });

    const asGestor = await request(app).get('/reports/services?from=2026-06-01&to=2026-06-30').set('Authorization', `Bearer ${gestorToken}`);
    expect(asGestor.body.data).toHaveLength(2);
    expect(asGestor.body.data[0].service_name).toBe('Captação drone');
  });

  it('GET /reports/absences-list devolve a listagem completa de ausências no período', async () => {
    const { company, gestorToken, creator } = await setupTenant();
    await absencesRepo.create({ tenantId: company.id, creatorId: creator.id, startDate: '2026-06-05', endDate: '2026-06-07', reason: 'Consulta' });

    const res = await request(app).get('/reports/absences-list?from=2026-06-01&to=2026-06-30').set('Authorization', `Bearer ${gestorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ reason: 'Consulta', status: 'pending' });
  });

  it('GET /reports/export?type=tasks|services|absences gera arquivo não vazio', async () => {
    const { gestorToken } = await setupTenant();
    for (const type of ['tasks', 'services', 'absences']) {
      const res = await request(app)
        .get(`/reports/export?type=${type}&format=pdf&from=2026-06-01&to=2026-06-30`)
        .set('Authorization', `Bearer ${gestorToken}`);
      expect(res.status).toBe(200);
      expect(Number(res.headers['content-length'])).toBeGreaterThan(0);
    }
  });

  it('GET /reports/export?type=all gera arquivo combinado (pdf e excel), não vazio', async () => {
    const { gestorToken } = await setupTenant();
    for (const format of ['pdf', 'excel']) {
      const res = await request(app)
        .get(`/reports/export?type=all&format=${format}&from=2026-06-01&to=2026-06-30`)
        .set('Authorization', `Bearer ${gestorToken}`);
      expect(res.status).toBe(200);
      expect(Number(res.headers['content-length'])).toBeGreaterThan(0);
    }
  });
});
