/**
 * Stub de tempo-real para o chat (Socket.IO no backend Node).
 *
 * Em mock, é um EventEmitter local — nada vai à rede.
 * Para usar o backend real:
 *   1) npm i socket.io-client
 *   2) troque a implementação `connectReal` abaixo (já comentada) pela mock.
 *   3) o backend deve emitir 'message:new' e aceitar 'message:send'.
 */
import type { Message } from '@/types';

type Handler = (msg: Message) => void;

export interface ChatSocket {
  onMessage(h: Handler): () => void;
  send(msg: Message): void;
  disconnect(): void;
}

const USE_MOCK = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false';

function connectMock(): ChatSocket {
  const handlers = new Set<Handler>();
  return {
    onMessage(h) { handlers.add(h); return () => handlers.delete(h); },
    send(msg) { setTimeout(() => handlers.forEach((h) => h(msg)), 60); }, // eco local
    disconnect() { handlers.clear(); },
  };
}

/*
// Implementação real (descomente após `npm i socket.io-client`):
import { io, type Socket } from 'socket.io-client';
function connectReal(token: string): ChatSocket {
  const socket: Socket = io(import.meta.env.VITE_SOCKET_URL, { auth: { token } });
  return {
    onMessage(h) { socket.on('message:new', h); return () => socket.off('message:new', h); },
    send(msg) { socket.emit('message:send', msg); },
    disconnect() { socket.disconnect(); },
  };
}
*/

export function connectChat(_token?: string): ChatSocket {
  // if (!USE_MOCK) return connectReal(_token!);
  void USE_MOCK;
  return connectMock();
}
