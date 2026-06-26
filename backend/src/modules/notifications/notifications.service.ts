import type { db as Db } from '../../db/client.js';
import type { AuthContext } from '../../middleware/authenticate.js';
import type { Pagination } from '../../lib/pagination.js';
import { createNoopEmitter, type RealtimeEmitter } from '../../realtime/emitter.js';
import { createNoopPushSender, type PushSender } from '../../realtime/pushSender.js';
import { createNotificationsRepository } from './notifications.repository.js';
import type { NotificationType } from '../../db/schema/index.js';

export function createNotificationsService(
  db: typeof Db,
  emitter: RealtimeEmitter = createNoopEmitter(),
  pushSender: PushSender = createNoopPushSender(),
) {
  const repo = createNotificationsRepository(db);

  return {
    list(auth: AuthContext, pagination: Pagination) {
      return repo.list(auth.tenantId, auth.userId, pagination);
    },

    markAllRead(auth: AuthContext) {
      return repo.markAllRead(auth.tenantId, auth.userId);
    },

    deleteRead(auth: AuthContext) {
      return repo.deleteRead(auth.tenantId, auth.userId);
    },

    /**
     * Entry point único dos gatilhos (tasks/absences/shifts/schedule) — grava em `notifications`,
     * emite `notification:new` (app aberto) e dispara push (app fechado/em background) na mesma
     * chamada, nunca como passos separados (specs/06).
     */
    async notify(tenantId: string, userId: string, type: NotificationType, title: string, description?: string | null) {
      const row = await repo.create({ tenantId, userId, type, title, description });
      emitter.toUser(userId, 'notification:new', row);
      await pushSender.sendToUser(tenantId, userId, { title, body: description ?? undefined, data: { type, notification_id: row.id } });
      return row;
    },
  };
}

export type NotificationsService = ReturnType<typeof createNotificationsService>;
