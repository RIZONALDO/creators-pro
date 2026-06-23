import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testDb, testPool } from '../test/db.js';
import { createCompaniesRepository } from '../modules/auth/companies.repository.js';
import { createUsersRepository } from '../modules/auth/users.repository.js';
import { createMessagesService } from '../modules/messages/messages.service.js';
import { createNotificationsService } from '../modules/notifications/notifications.service.js';
import { signAccessToken } from '../lib/jwt.js';
import { createSocketEmitter } from './emitter.js';
import { attachRealtime } from './socketServer.js';

function waitFor<T = unknown>(socket: ClientSocket, event: string, timeoutMs = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout esperando '${event}'`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('realtime (Socket.IO) — specs/05', () => {
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);

  const httpServer = createServer();
  const io = new SocketIOServer(httpServer);
  const emitter = createSocketEmitter(io);
  attachRealtime(io, { messagesService: createMessagesService(testDb, emitter) });
  const notificationsService = createNotificationsService(testDb, emitter);

  let baseUrl: string;
  let clients: ClientSocket[] = [];

  beforeAll(async () => {
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const { port } = httpServer.address() as AddressInfo;
    baseUrl = `http://localhost:${port}`;
  });

  afterAll(async () => {
    io.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await testPool.end();
  });

  beforeEach(async () => {
    await resetDb();
  });

  afterEach(() => {
    for (const client of clients) client.disconnect();
    clients = [];
  });

  function connect(token?: string): ClientSocket {
    const socket = ioClient(baseUrl, { auth: token ? { token } : {}, reconnection: false, forceNew: true });
    clients.push(socket);
    return socket;
  }

  async function setupTwoTenants() {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const companyA = await companiesRepo.create({ name: 'Tenant A', slug: `tenant-a-${suffix}` });
    const companyB = await companiesRepo.create({ name: 'Tenant B', slug: `tenant-b-${suffix}` });

    const userA1 = await usersRepo.create({ tenantId: companyA.id, name: 'Gestora A', email: `a1-${suffix}@test.com`, passwordHash: 'hash', role: 'gestor' });
    const userA2 = await usersRepo.create({ tenantId: companyA.id, name: 'Creator A', email: `a2-${suffix}@test.com`, passwordHash: 'hash', role: 'operacional' });
    const userB1 = await usersRepo.create({ tenantId: companyB.id, name: 'Gestora B', email: `b1-${suffix}@test.com`, passwordHash: 'hash', role: 'gestor' });

    return {
      companyA,
      userA1,
      userA2,
      userB1,
      tokenA1: signAccessToken({ sub: userA1.id, tenant_id: companyA.id, role: 'gestor' }),
      tokenA2: signAccessToken({ sub: userA2.id, tenant_id: companyA.id, role: 'operacional' }),
      tokenB1: signAccessToken({ sub: userB1.id, tenant_id: companyB.id, role: 'gestor' }),
    };
  }

  it('conexão sem token é rejeitada (connect_error), nunca aceita sem autenticação', async () => {
    const socket = connect();
    const err = await waitFor<Error>(socket, 'connect_error');
    expect(err).toBeDefined();
  });

  it('message:send entrega message:new só pro destinatário (room user:<id>), não pra outro usuário nem de outro tenant', async () => {
    const { userA2, tokenA1, tokenA2, tokenB1 } = await setupTwoTenants();

    const socketA1 = connect(tokenA1);
    const socketA2 = connect(tokenA2);
    const socketB1 = connect(tokenB1);
    await Promise.all([waitFor(socketA1, 'connect'), waitFor(socketA2, 'connect'), waitFor(socketB1, 'connect')]);

    let receivedByB1 = false;
    socketB1.once('message:new', () => {
      receivedByB1 = true;
    });
    const receivedByA2 = waitFor<{ message: string; receiver_id: string }>(socketA2, 'message:new');

    socketA1.emit('message:send', { receiver_id: userA2.id, message: 'Oi, bom dia!' });

    const payload = await receivedByA2;
    expect(payload.message).toBe('Oi, bom dia!');
    expect(payload.receiver_id).toBe(userA2.id);

    await wait(150);
    expect(receivedByB1).toBe(false);
  });

  it('notification:new emitido pelo notificationsService chega só na room user:<id> certa', async () => {
    const { companyA, userA1, userA2, tokenA1, tokenA2 } = await setupTwoTenants();

    const socketA1 = connect(tokenA1);
    const socketA2 = connect(tokenA2);
    await Promise.all([waitFor(socketA1, 'connect'), waitFor(socketA2, 'connect')]);

    let receivedByA1 = false;
    socketA1.once('notification:new', () => {
      receivedByA1 = true;
    });
    const receivedByA2 = waitFor<{ type: string; title: string }>(socketA2, 'notification:new');

    await notificationsService.notify(companyA.id, userA2.id, 'nova_tarefa', 'Nova tarefa', 'Reels institucional');

    const payload = await receivedByA2;
    expect(payload.type).toBe('nova_tarefa');
    expect(payload.title).toBe('Nova tarefa');

    await wait(150);
    expect(receivedByA1).toBe(false);
  });
});
