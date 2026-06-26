import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';

describe('rotas de collaborators (integração)', () => {
  const app = createApp(testDb);
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);

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

  it('POST /collaborators cria collaborator sem conta de usuário, com nome e profissão', async () => {
    const { token } = await loginAsGestor();

    const res = await request(app)
      .post('/collaborators')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Novo Colaborador', email: 'novo-colab@acme.com', profession: 'Sonoplasta', employment_type: 'freelancer' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Novo Colaborador');
    expect(res.body.profession).toBe('Sonoplasta');
    expect(res.body.invite_token).toBeUndefined();
  });

  it('POST /collaborators cria collaborator só com nome e profissão (email/phone opcionais)', async () => {
    const { token } = await loginAsGestor();

    const res = await request(app)
      .post('/collaborators')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Só Nome', profession: 'Editor', employment_type: 'fixed' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Só Nome');
    expect(res.body.email).toBeNull();
  });

  it('PUT /collaborators/:id atualiza profissão', async () => {
    const { token } = await loginAsGestor();
    const created = await request(app)
      .post('/collaborators')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'A', email: 'a@acme.com', profession: 'Editor', employment_type: 'fixed' });

    const res = await request(app)
      .put(`/collaborators/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ profession: 'Roteirista' });

    expect(res.status).toBe(200);
    expect(res.body.profession).toBe('Roteirista');
  });

  it('GET /collaborators sem token retorna 401', async () => {
    const res = await request(app).get('/collaborators');
    expect(res.status).toBe(401);
  });

  it('DELETE /collaborators/:id remove o collaborator', async () => {
    const { token } = await loginAsGestor();
    const created = await request(app)
      .post('/collaborators')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Sem vínculo', profession: 'Editor', employment_type: 'fixed' });

    const res = await request(app).delete(`/collaborators/${created.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);

    const list = await request(app).get('/collaborators').set('Authorization', `Bearer ${token}`);
    expect(list.body.data.find((c: { id: string }) => c.id === created.body.id)).toBeUndefined();
  });

  it('DELETE /collaborators/:id com serviço vinculado retorna 409', async () => {
    const { token } = await loginAsGestor();
    const created = await request(app)
      .post('/collaborators')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Com serviço', profession: 'Fotógrafo', employment_type: 'fixed' });
    await request(app).post('/services').set('Authorization', `Bearer ${token}`).send({ service_name: 'Sessão de fotos', collaborator_id: created.body.id });

    const res = await request(app).delete(`/collaborators/${created.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('COLLABORATOR_HAS_LINKED_RECORDS');
  });
});
