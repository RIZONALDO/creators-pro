import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { createCreatorsRepository } from '../creators/creators.repository.js';

describe('rotas de messages (integração)', () => {
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
    const gestor = await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: 'gestora@acme.com', passwordHash, role: 'gestor' });
    const creator = await usersRepo.create({ tenantId: company.id, name: 'Creator', email: 'creator@acme.com', passwordHash, role: 'operacional' });
    const loginGestor = await request(app).post('/auth/login').send({ email: 'gestora@acme.com', password: 'senha123' });
    const loginCreator = await request(app).post('/auth/login').send({ email: 'creator@acme.com', password: 'senha123' });
    return { company, gestor, creator, gestorToken: loginGestor.body.token as string, creatorToken: loginCreator.body.token as string };
  }

  it('POST /messages + GET /messages?with= retornam a conversa entre os dois, e ler a thread zera o unread', async () => {
    const { gestor, creator, gestorToken, creatorToken } = await setupTenant();

    const sent = await request(app).post('/messages').set('Authorization', `Bearer ${gestorToken}`).send({ receiver_id: creator.id, message: 'Bom dia! Tudo certo pra hoje?' });
    expect(sent.status).toBe(201);
    expect(sent.body.message).toBe('Bom dia! Tudo certo pra hoje?');

    const thread = await request(app).get(`/messages?with=${creator.id}`).set('Authorization', `Bearer ${gestorToken}`);
    expect(thread.body.data).toHaveLength(1);

    const beforeRead = await request(app).get('/conversations').set('Authorization', `Bearer ${creatorToken}`);
    expect(beforeRead.body.data[0].unread).toBe(1);

    // o creator lê a thread com a gestora — marca a mensagem recebida como lida
    await request(app).get(`/messages?with=${gestor.id}`).set('Authorization', `Bearer ${creatorToken}`);

    const afterRead = await request(app).get('/conversations').set('Authorization', `Bearer ${creatorToken}`);
    expect(afterRead.body.data[0].unread).toBe(0);
  });

  it('POST /messages para usuário de outro tenant falha com INVALID_RECEIVER', async () => {
    const { gestorToken } = await setupTenant();
    const otherCompany = await companiesRepo.create({ name: 'Other', slug: 'other' });
    const otherUser = await usersRepo.create({ tenantId: otherCompany.id, name: 'De fora', email: 'fora@other.com', passwordHash: 'hash', role: 'operacional' });

    const res = await request(app).post('/messages').set('Authorization', `Bearer ${gestorToken}`).send({ receiver_id: otherUser.id, message: 'oi' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_RECEIVER');
  });

  it('GET /conversations lista o interlocutor com a última mensagem e contagem de não lidas', async () => {
    const { creator, gestorToken, creatorToken } = await setupTenant();

    await request(app).post('/messages').set('Authorization', `Bearer ${gestorToken}`).send({ receiver_id: creator.id, message: 'Primeira' });
    await request(app).post('/messages').set('Authorization', `Bearer ${gestorToken}`).send({ receiver_id: creator.id, message: 'Segunda' });

    const conversations = await request(app).get('/conversations').set('Authorization', `Bearer ${creatorToken}`);
    expect(conversations.body.data).toHaveLength(1);
    expect(conversations.body.data[0].last_message).toBe('Segunda');
    expect(conversations.body.data[0].unread).toBe(2);
  });

  it('GET /messages/contacts: operacional vê a coordenação (gestor/admin), mesmo sem nunca ter trocado mensagem', async () => {
    const { company, creatorToken } = await setupTenant();
    const passwordHash = await bcrypt.hash('senha123', 4);
    await usersRepo.create({ tenantId: company.id, name: 'Admin', email: 'admin@acme.com', passwordHash, role: 'admin' });

    const res = await request(app).get('/messages/contacts').set('Authorization', `Bearer ${creatorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((c: { name: string }) => c.name).sort()).toEqual(['Admin', 'Gestora']);
  });

  it('GET /messages/contacts: gestor/admin vê os creators do tenant', async () => {
    const { company, gestorToken, creator } = await setupTenant();
    await creatorsRepo.createRow({ tenantId: company.id, userId: creator.id, employmentType: 'fixed' });

    const res = await request(app).get('/messages/contacts').set('Authorization', `Bearer ${gestorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].user_id).toBe(creator.id);
    expect(res.body.data[0].name).toBe('Creator');
  });
});
