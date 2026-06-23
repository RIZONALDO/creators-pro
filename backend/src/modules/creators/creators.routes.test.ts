import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';

describe('rotas de creators (integração)', () => {
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

  async function loginAsOperacional(tenantId: string) {
    const passwordHash = await bcrypt.hash('senha123', 4);
    await usersRepo.create({ tenantId, name: 'Operacional', email: 'op@acme.com', passwordHash, role: 'operacional' });
    const login = await request(app).post('/auth/login').send({ email: 'op@acme.com', password: 'senha123' });
    return login.body.token as string;
  }

  it('POST /creators cria usuário + creator', async () => {
    const { token } = await loginAsGestor();

    const res = await request(app)
      .post('/creators')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Novo Creator', email: 'novo-creator@acme.com', employment_type: 'fixed', password: 'senha12345' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Novo Creator');
    expect(res.body.employment_type).toBe('fixed');
  });

  it('creator loga com a senha definida na criação', async () => {
    const { token } = await loginAsGestor();
    await request(app).post('/creators').set('Authorization', `Bearer ${token}`).send({ name: 'Login', email: 'login-creator@acme.com', employment_type: 'fixed', password: 'senhaDoCreator1' });

    const login = await request(app).post('/auth/login').send({ email: 'login-creator@acme.com', password: 'senhaDoCreator1' });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe('operacional');
  });

  it('PUT /creators/:id com password reseta a senha — a antiga deixa de funcionar', async () => {
    const { token } = await loginAsGestor();
    const created = await request(app).post('/creators').set('Authorization', `Bearer ${token}`).send({ name: 'Reset', email: 'reset-creator@acme.com', employment_type: 'fixed', password: 'senhaAntiga1' });

    const res = await request(app).put(`/creators/${created.body.id}`).set('Authorization', `Bearer ${token}`).send({ password: 'senhaNova123' });
    expect(res.status).toBe(200);

    const oldLogin = await request(app).post('/auth/login').send({ email: 'reset-creator@acme.com', password: 'senhaAntiga1' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app).post('/auth/login').send({ email: 'reset-creator@acme.com', password: 'senhaNova123' });
    expect(newLogin.status).toBe(200);
  });

  it('POST /creators com e-mail duplicado retorna 409', async () => {
    const { token } = await loginAsGestor();
    await request(app).post('/creators').set('Authorization', `Bearer ${token}`).send({ name: 'A', email: 'dup@acme.com', employment_type: 'fixed', password: 'senha12345' });

    const res = await request(app).post('/creators').set('Authorization', `Bearer ${token}`).send({ name: 'B', email: 'dup@acme.com', employment_type: 'fixed', password: 'senha12345' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('GET /creators lista os criados', async () => {
    const { token } = await loginAsGestor();
    await request(app).post('/creators').set('Authorization', `Bearer ${token}`).send({ name: 'A', email: 'a@acme.com', employment_type: 'fixed', password: 'senha12345' });

    const res = await request(app).get('/creators').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
  });

  it('PUT /creators/:id atualiza active', async () => {
    const { token } = await loginAsGestor();
    const created = await request(app)
      .post('/creators')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'A', email: 'a@acme.com', employment_type: 'fixed', password: 'senha12345' });

    const res = await request(app).put(`/creators/${created.body.id}`).set('Authorization', `Bearer ${token}`).send({ active: false });

    expect(res.status).toBe(200);
    expect(res.body.active).toBe(false);
  });

  it('operacional recebe 403 em /creators (RBAC)', async () => {
    const { company } = await loginAsGestor();
    const opToken = await loginAsOperacional(company.id);

    const res = await request(app).get('/creators').set('Authorization', `Bearer ${opToken}`);
    expect(res.status).toBe(403);
  });

  it('DELETE /creators/:id remove o creator e o usuário/login vinculado quando não há vínculo', async () => {
    const { token } = await loginAsGestor();
    const created = await request(app)
      .post('/creators')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Sem vínculo', email: 'sem-vinculo@acme.com', employment_type: 'fixed', password: 'senha12345' });

    const res = await request(app).delete(`/creators/${created.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);

    const list = await request(app).get('/creators').set('Authorization', `Bearer ${token}`);
    expect(list.body.data.find((c: { id: string }) => c.id === created.body.id)).toBeUndefined();

    // o e-mail volta a ficar livre — confirma que o usuário vinculado também foi apagado, não só o creator
    const recreated = await request(app)
      .post('/creators')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Outro nome', email: 'sem-vinculo@acme.com', employment_type: 'freelancer', password: 'senha12345' });
    expect(recreated.status).toBe(201);
  });

  it('DELETE /creators/:id com tarefa vinculada retorna 409 e não apaga nada', async () => {
    const { token } = await loginAsGestor();
    const created = await request(app)
      .post('/creators')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Com tarefa', email: 'com-tarefa@acme.com', employment_type: 'fixed', password: 'senha12345' });
    await request(app).post('/tasks').set('Authorization', `Bearer ${token}`).send({ title: 'Reels', creator_id: created.body.id });

    const res = await request(app).delete(`/creators/${created.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CREATOR_HAS_LINKED_RECORDS');

    const list = await request(app).get('/creators').set('Authorization', `Bearer ${token}`);
    expect(list.body.data.find((c: { id: string }) => c.id === created.body.id)).toBeDefined();
  });

  it('PUT /creators/reorder muda a sequência usada pela escala automática', async () => {
    const { token } = await loginAsGestor();
    const created = [];
    for (let i = 0; i < 3; i++) {
      const res = await request(app).post('/creators').set('Authorization', `Bearer ${token}`).send({ name: `C${i}`, email: `c${i}-reorder@acme.com`, employment_type: 'fixed', password: 'senha12345' });
      created.push(res.body.id as string);
    }
    const [a, b, c] = created as [string, string, string];

    const reorderRes = await request(app).put('/creators/reorder').set('Authorization', `Bearer ${token}`).send({ creator_ids: [c, a, b] });
    expect(reorderRes.status).toBe(204);

    const list = await request(app).get('/scale-entries?month=2026-06').set('Authorization', `Bearer ${token}`);
    const auto = await request(app).post(`/scale-months/${list.body.scale_month_id}/auto-assign`).set('Authorization', `Bearer ${token}`);

    const day1 = auto.body.data.find((e: { work_date: string; creator_id: string }) => e.work_date === '2026-06-01');
    expect(day1?.creator_id).toBe(c); // primeiro da nova ordem, não o primeiro criado
  });

  it('operacional recebe 403 ao tentar reordenar creators', async () => {
    const { company, token } = await loginAsGestor();
    const opToken = await loginAsOperacional(company.id);
    const created = await request(app).post('/creators').set('Authorization', `Bearer ${token}`).send({ name: 'X', email: 'x-reorder@acme.com', employment_type: 'fixed', password: 'senha12345' });

    const res = await request(app).put('/creators/reorder').set('Authorization', `Bearer ${opToken}`).send({ creator_ids: [created.body.id] });
    expect(res.status).toBe(403);
  });

  it('operacional recebe 403 ao tentar excluir creator', async () => {
    const { company, token } = await loginAsGestor();
    const opToken = await loginAsOperacional(company.id);
    const created = await request(app)
      .post('/creators')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'X', email: 'x-delete@acme.com', employment_type: 'fixed', password: 'senha12345' });

    const res = await request(app).delete(`/creators/${created.body.id}`).set('Authorization', `Bearer ${opToken}`);
    expect(res.status).toBe(403);
  });
});
