/**
 * Suíte de isolamento entre tenants — nasce na Fase 1 (não na Fase 9, ver specs/07-roadmap-implementacao.md).
 * Toda fase futura que adiciona um recurso novo (creators, tasks, absences, ...) estende este arquivo
 * com 1-2 casos cobrindo "tenant A nunca vê/edita dado do tenant B nesse recurso".
 */
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { resetDb, testDb, testPool } from './db.js';
import { withTwoTenants } from './helpers/withTwoTenants.js';

describe('isolamento entre tenants', () => {
  const app = createApp(testDb);

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
});
