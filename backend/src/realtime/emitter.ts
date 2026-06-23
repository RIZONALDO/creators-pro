import type { Server as SocketIOServer } from 'socket.io';
import { toSnakeCase } from '../lib/caseConvert.js';

/** Camada usada pelos services pra emitir eventos sem conhecer Socket.IO diretamente (testável sem servidor real). */
export interface RealtimeEmitter {
  toUser(userId: string, event: string, payload: unknown): void;
}

/** Mesma conversão camelCase->snake_case do REST (snakeCaseResponse) — payload do socket segue o mesmo contrato. */
export function createSocketEmitter(io: SocketIOServer): RealtimeEmitter {
  return {
    toUser(userId, event, payload) {
      io.to(`user:${userId}`).emit(event, toSnakeCase(payload));
    },
  };
}

/** Usado em testes/contextos sem servidor de socket — persiste no banco, só não emite nada. */
export function createNoopEmitter(): RealtimeEmitter {
  return { toUser() {} };
}
