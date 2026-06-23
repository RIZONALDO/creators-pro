/**
 * Tempo-real (Socket.IO no backend Node — ver backend/src/realtime). Uma conexão só serve tanto
 * o chat (message:new) quanto o sino de notificações (notification:new) — o servidor já coloca
 * todo socket autenticado na room `user:<id>`, de onde os dois eventos saem.
 * Em mock, é um EventEmitter local — nada vai à rede.
 */
import { io, type Socket } from 'socket.io-client';
import { getActiveBaseUrl } from './client';
import type { Message, Notification } from '@/types';

type MessageHandler = (msg: Message) => void;
type NotificationHandler = (n: Notification) => void;

export interface RealtimeSocket {
  onMessage(h: MessageHandler): () => void;
  onNotification(h: NotificationHandler): () => void;
  send(msg: { receiver_id: string; message: string }): void;
  disconnect(): void;
}

const USE_MOCK = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false';

function connectMock(): RealtimeSocket {
  const messageHandlers = new Set<MessageHandler>();
  const notificationHandlers = new Set<NotificationHandler>();
  return {
    onMessage(h) { messageHandlers.add(h); return () => messageHandlers.delete(h); },
    onNotification(h) { notificationHandlers.add(h); return () => notificationHandlers.delete(h); },
    send() { /* mock não tem servidor — as telas já gravam via REST (api.messages.send()) */ },
    disconnect() { messageHandlers.clear(); notificationHandlers.clear(); },
  };
}

function connectReal(token: string): RealtimeSocket {
  // connectRealtime só é chamado depois de login bem-sucedido — getActiveBaseUrl() já está
  // resolvido pro host certo nesse ponto (mesmo fallback de localhost/IPs usado pelo REST).
  const socket: Socket = io(getActiveBaseUrl(), { auth: { token } });
  return {
    onMessage(h) { socket.on('message:new', h); return () => socket.off('message:new', h); },
    onNotification(h) { socket.on('notification:new', h); return () => socket.off('notification:new', h); },
    send(msg) { socket.emit('message:send', msg); },
    disconnect() { socket.disconnect(); },
  };
}

export function connectRealtime(token?: string | null): RealtimeSocket {
  if (!USE_MOCK && token) return connectReal(token);
  return connectMock();
}
