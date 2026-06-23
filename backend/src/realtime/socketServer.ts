import type { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyAccessToken } from '../lib/jwt.js';
import type { AuthContext } from '../middleware/authenticate.js';
import type { MessagesService } from '../modules/messages/messages.service.js';

interface SocketData {
  auth: AuthContext;
}

type AppSocket = Socket<{ 'message:send': (payload: { receiver_id: string; message: string }, ack?: (res: { ok: boolean; data?: unknown; error?: string }) => void) => void }, Record<string, never>, Record<string, never>, SocketData>;

/**
 * Handshake autenticado (mesmo access token do REST) + rooms automáticas `tenant:<id>`/`user:<id>`
 * (specs/05-realtime-socketio.md) — nunca informadas pelo client, sempre derivadas do JWT.
 */
export function attachRealtime(io: SocketIOServer, deps: { messagesService: MessagesService }) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('unauthorized'));
    try {
      const payload = verifyAccessToken(token);
      (socket.data as SocketData).auth = { userId: payload.sub, tenantId: payload.tenant_id, role: payload.role };
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket: AppSocket) => {
    const auth = socket.data.auth;
    socket.join(`tenant:${auth.tenantId}`);
    socket.join(`user:${auth.userId}`);

    // REST (POST /messages) e socket convergem no mesmo messagesService.send — emissão de
    // message:new fica só lá dentro, nunca duplicada entre os dois handlers.
    socket.on('message:send', async (payload, ack) => {
      try {
        const message = await deps.messagesService.send(auth, { receiver_id: payload.receiver_id, message: payload.message });
        ack?.({ ok: true, data: message });
      } catch (err) {
        ack?.({ ok: false, error: err instanceof Error ? err.message : 'Erro ao enviar mensagem.' });
      }
    });
  });
}
