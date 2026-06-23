import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { createCreatorsRepository } from '../creators/creators.repository.js';
import { createTasksRepository } from '../tasks/tasks.repository.js';

describe('rotas de attachments (integração)', () => {
  const app = createApp(testDb);
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);
  const creatorsRepo = createCreatorsRepository(testDb);
  const tasksRepo = createTasksRepository(testDb);

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
    const otherCreatorUser = await usersRepo.create({ tenantId: company.id, name: 'Outro', email: 'outro@acme.com', passwordHash, role: 'operacional' });
    await creatorsRepo.createRow({ tenantId: company.id, userId: otherCreatorUser.id, employmentType: 'fixed' });
    const task = await tasksRepo.create({ tenantId: company.id, title: 'Tarefa', taskDate: '2026-06-10', creatorId: creator.id, createdBy: gestor.id });

    const gestorLogin = await request(app).post('/auth/login').send({ email: 'gestora@acme.com', password: 'senha123' });
    const creatorLogin = await request(app).post('/auth/login').send({ email: 'creator@acme.com', password: 'senha123' });
    const otherLogin = await request(app).post('/auth/login').send({ email: 'outro@acme.com', password: 'senha123' });
    return {
      company, task,
      gestorToken: gestorLogin.body.token as string,
      creatorToken: creatorLogin.body.token as string,
      otherToken: otherLogin.body.token as string,
    };
  }

  it('POST /attachments sobe o arquivo e devolve os metadados', async () => {
    const { gestorToken, task } = await setupTenant();
    const res = await request(app)
      .post('/attachments')
      .set('Authorization', `Bearer ${gestorToken}`)
      .field('entity_type', 'task')
      .field('entity_id', task.id)
      .attach('file', Buffer.from('conteúdo de teste'), 'foto.png');

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ file_name: 'foto.png', entity_type: 'task', entity_id: task.id, mime_type: 'image/png' });
  });

  it('sem arquivo, 400', async () => {
    const { gestorToken, task } = await setupTenant();
    const res = await request(app).post('/attachments').set('Authorization', `Bearer ${gestorToken}`).field('entity_type', 'task').field('entity_id', task.id);
    expect(res.status).toBe(400);
  });

  it('operacional não sobe anexo em tarefa de outro creator (403)', async () => {
    const { otherToken, task } = await setupTenant();
    const res = await request(app)
      .post('/attachments')
      .set('Authorization', `Bearer ${otherToken}`)
      .field('entity_type', 'task')
      .field('entity_id', task.id)
      .attach('file', Buffer.from('x'), 'x.png');
    expect(res.status).toBe(403);
  });

  it('GET /attachments?entity_type=&entity_id= lista os anexos da entidade', async () => {
    const { gestorToken, creatorToken, task } = await setupTenant();
    await request(app).post('/attachments').set('Authorization', `Bearer ${gestorToken}`).field('entity_type', 'task').field('entity_id', task.id).attach('file', Buffer.from('a'), 'a.png');
    await request(app).post('/attachments').set('Authorization', `Bearer ${gestorToken}`).field('entity_type', 'task').field('entity_id', task.id).attach('file', Buffer.from('b'), 'b.png');

    const res = await request(app).get(`/attachments?entity_type=task&entity_id=${task.id}`).set('Authorization', `Bearer ${creatorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('GET /attachments/:id/file devolve os bytes exatos enviados', async () => {
    const { gestorToken, task } = await setupTenant();
    const upload = await request(app)
      .post('/attachments')
      .set('Authorization', `Bearer ${gestorToken}`)
      .field('entity_type', 'task')
      .field('entity_id', task.id)
      .attach('file', Buffer.from('conteúdo XYZ'), 'foto.txt');

    const res = await request(app).get(`/attachments/${upload.body.data.id}/file`).set('Authorization', `Bearer ${gestorToken}`);
    expect(res.status).toBe(200);
    expect(res.text).toBe('conteúdo XYZ');
  });

  it('DELETE /attachments/:id remove o anexo; só quem subiu (ou gestor) pode excluir', async () => {
    const { gestorToken, creatorToken, otherToken, task } = await setupTenant();
    const upload = await request(app)
      .post('/attachments')
      .set('Authorization', `Bearer ${creatorToken}`)
      .field('entity_type', 'task')
      .field('entity_id', task.id)
      .attach('file', Buffer.from('a'), 'a.png');
    const id = upload.body.data.id;

    const forbidden = await request(app).delete(`/attachments/${id}`).set('Authorization', `Bearer ${otherToken}`);
    expect(forbidden.status).toBe(403);

    const ok = await request(app).delete(`/attachments/${id}`).set('Authorization', `Bearer ${gestorToken}`);
    expect(ok.status).toBe(204);

    const after = await request(app).get(`/attachments/${id}/file`).set('Authorization', `Bearer ${gestorToken}`);
    expect(after.status).toBe(404);
  });

  it('sem token autenticado, 401', async () => {
    const { task } = await setupTenant();
    const res = await request(app).get(`/attachments?entity_type=task&entity_id=${task.id}`);
    expect(res.status).toBe(401);
  });
});
