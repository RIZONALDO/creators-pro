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

  it('POST /collaborators cria usuário + collaborator com profissão', async () => {
    const { token } = await loginAsGestor();

    const res = await request(app)
      .post('/collaborators')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Novo Colaborador', email: 'novo-colab@acme.com', profession: 'Sonoplasta', employment_type: 'freelancer', password: 'senha12345' });

    expect(res.status).toBe(201);
    expect(res.body.profession).toBe('Sonoplasta');
  });

  it('colaborador loga com a senha definida na criação', async () => {
    const { token } = await loginAsGestor();
    await request(app).post('/collaborators').set('Authorization', `Bearer ${token}`).send({ name: 'Login', email: 'login-colab@acme.com', profession: 'Editor', employment_type: 'freelancer', password: 'senhaDoColab1' });

    const login = await request(app).post('/auth/login').send({ email: 'login-colab@acme.com', password: 'senhaDoColab1' });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe('operacional');
  });

  it('POST /collaborators só com e-mail (sem nome/senha) cria conta pending, com o e-mail como nome provisório', async () => {
    const { token } = await loginAsGestor();

    const res = await request(app).post('/collaborators').set('Authorization', `Bearer ${token}`).send({ email: 'convite-colab@acme.com', profession: 'Editor', employment_type: 'freelancer' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('convite-colab@acme.com');

    const login = await request(app).post('/auth/login').send({ email: 'convite-colab@acme.com', password: 'qualquer-coisa' });
    expect(login.status).toBe(401);
  });

  it('POST /collaborators sem senha devolve invite_token (link de convite) — com senha, não devolve nenhum', async () => {
    const { token } = await loginAsGestor();

    const pending = await request(app).post('/collaborators').set('Authorization', `Bearer ${token}`).send({ email: 'convite-colab-token@acme.com', profession: 'Editor', employment_type: 'freelancer' });
    expect(pending.status).toBe(201);
    expect(typeof pending.body.invite_token).toBe('string');
    expect(pending.body.invite_token.length).toBeGreaterThan(20);

    const withPassword = await request(app).post('/collaborators').set('Authorization', `Bearer ${token}`).send({ name: 'Com Senha', email: 'com-senha-colab@acme.com', profession: 'Editor', employment_type: 'freelancer', password: 'senha12345' });
    expect(withPassword.status).toBe(201);
    expect(withPassword.body.invite_token).toBeUndefined();
  });

  it('POST /collaborators/:id/invite numa conta pending gera um invite_token novo, diferente do original', async () => {
    const { token } = await loginAsGestor();
    const created = await request(app).post('/collaborators').set('Authorization', `Bearer ${token}`).send({ email: 'regen-colab@acme.com', profession: 'Editor', employment_type: 'freelancer' });

    const res = await request(app).post(`/collaborators/${created.body.id}/invite`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.invite_token).toBe('string');
    expect(res.body.invite_token).not.toBe(created.body.invite_token);
  });

  it('POST /collaborators/:id/invite numa conta já ativa falha com 409 NOT_PENDING', async () => {
    const { token } = await loginAsGestor();
    const created = await request(app).post('/collaborators').set('Authorization', `Bearer ${token}`).send({ name: 'Ativo', email: 'colab-ja-ativo@acme.com', profession: 'Editor', employment_type: 'freelancer', password: 'senha12345' });

    const res = await request(app).post(`/collaborators/${created.body.id}/invite`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NOT_PENDING');
  });

  it('PUT /collaborators/:id com password reseta a senha — a antiga deixa de funcionar', async () => {
    const { token } = await loginAsGestor();
    const created = await request(app).post('/collaborators').set('Authorization', `Bearer ${token}`).send({ name: 'Reset', email: 'reset-colab@acme.com', profession: 'Editor', employment_type: 'freelancer', password: 'senhaAntiga1' });

    const res = await request(app).put(`/collaborators/${created.body.id}`).set('Authorization', `Bearer ${token}`).send({ password: 'senhaNova123' });
    expect(res.status).toBe(200);

    const oldLogin = await request(app).post('/auth/login').send({ email: 'reset-colab@acme.com', password: 'senhaAntiga1' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app).post('/auth/login').send({ email: 'reset-colab@acme.com', password: 'senhaNova123' });
    expect(newLogin.status).toBe(200);
  });

  it('PUT /collaborators/:id atualiza profissão', async () => {
    const { token } = await loginAsGestor();
    const created = await request(app)
      .post('/collaborators')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'A', email: 'a@acme.com', profession: 'Editor', employment_type: 'fixed', password: 'senha12345' });

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

  it('DELETE /collaborators/:id remove o collaborator e o usuário vinculado quando não há vínculo', async () => {
    const { token } = await loginAsGestor();
    const created = await request(app)
      .post('/collaborators')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Sem vínculo', email: 'colab-sem-vinculo@acme.com', profession: 'Editor', employment_type: 'fixed', password: 'senha12345' });

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
      .send({ name: 'Com serviço', email: 'colab-com-servico@acme.com', profession: 'Fotógrafo', employment_type: 'fixed', password: 'senha12345' });
    await request(app).post('/services').set('Authorization', `Bearer ${token}`).send({ service_name: 'Sessão de fotos', collaborator_id: created.body.id });

    const res = await request(app).delete(`/collaborators/${created.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('COLLABORATOR_HAS_LINKED_RECORDS');
  });
});
