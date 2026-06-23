import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { createCreatorsRepository } from '../creators/creators.repository.js';

describe('rotas de absences (integração)', () => {
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
    const gestorLogin = await request(app).post('/auth/login').send({ email: 'gestora@acme.com', password: 'senha123' });

    const creatorUser = await usersRepo.create({ tenantId: company.id, name: 'Creator', email: 'creator@acme.com', passwordHash, role: 'operacional' });
    const creator = await creatorsRepo.createRow({ tenantId: company.id, userId: creatorUser.id, employmentType: 'fixed' });
    const creatorLogin = await request(app).post('/auth/login').send({ email: 'creator@acme.com', password: 'senha123' });

    return { company, creator, gestorToken: gestorLogin.body.token as string, creatorToken: creatorLogin.body.token as string };
  }

  it('creator solicita ausência via POST /absences', async () => {
    const { creator, creatorToken } = await setupTenant();
    const res = await request(app)
      .post('/absences')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ creator_id: creator.id, start_date: '2026-06-24', end_date: '2026-06-26', reason: 'Consulta médica' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
  });

  it('creator solicita ausência sem informar creator_id — resolve pelo próprio token', async () => {
    const { creator, creatorToken } = await setupTenant();
    const res = await request(app)
      .post('/absences')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ start_date: '2026-06-24', end_date: '2026-06-26', reason: 'Consulta médica' });

    expect(res.status).toBe(201);
    expect(res.body.creator_id).toBe(creator.id);
  });

  it('gestor não pode omitir creator_id (400)', async () => {
    const { gestorToken } = await setupTenant();
    const res = await request(app)
      .post('/absences')
      .set('Authorization', `Bearer ${gestorToken}`)
      .send({ start_date: '2026-06-24', end_date: '2026-06-26' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CREATOR_ID_REQUIRED');
  });

  it('creator não pode solicitar ausência para outro creator (403)', async () => {
    const { company, creatorToken } = await setupTenant();
    const otherUser = await usersRepo.create({ tenantId: company.id, name: 'Outro', email: 'outro@acme.com', passwordHash: await bcrypt.hash('x', 4), role: 'operacional' });
    const otherCreator = await creatorsRepo.createRow({ tenantId: company.id, userId: otherUser.id, employmentType: 'freelancer' });

    const res = await request(app)
      .post('/absences')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ creator_id: otherCreator.id, start_date: '2026-06-24', end_date: '2026-06-26' });

    expect(res.status).toBe(403);
  });

  it('gestor aprova ausência via PATCH /absences/:id/review', async () => {
    const { creator, gestorToken, creatorToken } = await setupTenant();
    const created = await request(app)
      .post('/absences')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ creator_id: creator.id, start_date: '2026-06-24', end_date: '2026-06-26' });

    const reviewed = await request(app).patch(`/absences/${created.body.id}/review`).set('Authorization', `Bearer ${gestorToken}`).send({ status: 'approved' });

    expect(reviewed.status).toBe(200);
    expect(reviewed.body.status).toBe('approved');
    expect(reviewed.body.approved_by).toBeDefined();
  });

  it('creator não pode revisar ausência (403)', async () => {
    const { creator, creatorToken } = await setupTenant();
    const created = await request(app)
      .post('/absences')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ creator_id: creator.id, start_date: '2026-06-24', end_date: '2026-06-26' });

    const res = await request(app).patch(`/absences/${created.body.id}/review`).set('Authorization', `Bearer ${creatorToken}`).send({ status: 'approved' });
    expect(res.status).toBe(403);
  });

  it('creator vê só a própria ausência em GET /absences', async () => {
    const { company, creator, gestorToken, creatorToken } = await setupTenant();
    const otherUser = await usersRepo.create({ tenantId: company.id, name: 'Outro', email: 'outro2@acme.com', passwordHash: await bcrypt.hash('x', 4), role: 'operacional' });
    const otherCreator = await creatorsRepo.createRow({ tenantId: company.id, userId: otherUser.id, employmentType: 'freelancer' });

    await request(app).post('/absences').set('Authorization', `Bearer ${creatorToken}`).send({ creator_id: creator.id, start_date: '2026-06-24', end_date: '2026-06-26' });
    await request(app).post('/absences').set('Authorization', `Bearer ${gestorToken}`).send({ creator_id: otherCreator.id, start_date: '2026-06-20', end_date: '2026-06-20' });

    const asCreator = await request(app).get('/absences').set('Authorization', `Bearer ${creatorToken}`);
    const asGestor = await request(app).get('/absences').set('Authorization', `Bearer ${gestorToken}`);

    expect(asCreator.body.data).toHaveLength(1);
    expect(asGestor.body.data).toHaveLength(2);
  });
});
