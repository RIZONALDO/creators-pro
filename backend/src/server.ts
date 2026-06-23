import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { Server as SocketIOServer } from 'socket.io';
import { createApp } from './app.js';
import { db } from './db/client.js';
import { env } from './lib/env.js';
import { createSocketEmitter } from './realtime/emitter.js';
import { attachRealtime } from './realtime/socketServer.js';
import { createNoopPushSender, createWebPushSender } from './realtime/pushSender.js';
import { createMessagesService } from './modules/messages/messages.service.js';

const io = new SocketIOServer({ cors: { origin: '*' } });
const emitter = createSocketEmitter(io);
attachRealtime(io, { messagesService: createMessagesService(db, emitter) });

// Sem VAPID configurado (.env), o app roda normal — só não envia push (createNoopPushSender).
const pushSender = env.vapidPublicKey && env.vapidPrivateKey
  ? createWebPushSender(db, { publicKey: env.vapidPublicKey, privateKey: env.vapidPrivateKey, subject: env.vapidSubject })
  : createNoopPushSender();

const app = createApp(db, emitter, pushSender);

// Service Worker/Push só existem em contexto seguro (localhost é a única exceção) — pra testar
// no celular pelo IP da rede local precisa de HTTPS de verdade (certificado mkcert, gerado em
// ../certs). Sem o certificado, cai pra HTTP normal (funciona em localhost, só não dá pra testar
// push de outro dispositivo).
const certDir = resolve(import.meta.dirname, '../../certs');
let httpServer;
let scheme: 'http' | 'https' = 'http';
try {
  const cert = readFileSync(join(certDir, 'dev-cert.pem'));
  const key = readFileSync(join(certDir, 'dev-key.pem'));
  httpServer = createHttpsServer({ cert, key }, app);
  scheme = 'https';
} catch {
  httpServer = createHttpServer(app);
}
io.attach(httpServer);

httpServer.listen(env.port, () => {
  console.log(`CreatorsPro API rodando em ${scheme}://localhost:${env.port}`);
});
