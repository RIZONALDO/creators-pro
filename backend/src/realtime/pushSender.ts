import webpush from 'web-push';
import type { db as Db } from '../db/client.js';
import { createPushSubscriptionsRepository } from '../modules/push/push.repository.js';

export interface PushPayload {
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}

export interface PushSender {
  sendToUser(tenantId: string, userId: string, payload: PushPayload): Promise<void>;
}

/** Usado quando VAPID não está configurado (.env) ou em testes — não envia nada, só não quebra o fluxo. */
export function createNoopPushSender(): PushSender {
  return { async sendToUser() {} };
}

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

function isDeadSubscriptionError(err: unknown): boolean {
  const statusCode = (err as { statusCode?: number } | null)?.statusCode;
  return statusCode === 404 || statusCode === 410;
}

/** Push real via Web Push (VAPID) — manda pra cada dispositivo inscrito do usuário; poda os que o serviço de push já considera mortos (404/410). */
export function createWebPushSender(db: typeof Db, vapid: VapidConfig): PushSender {
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  const pushRepo = createPushSubscriptionsRepository(db);

  return {
    async sendToUser(tenantId, userId, payload) {
      const subscriptions = await pushRepo.listByUser(tenantId, userId);
      if (subscriptions.length === 0) return;

      await Promise.allSettled(
        subscriptions.map(async (sub) => {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              JSON.stringify(payload),
            );
          } catch (err) {
            if (isDeadSubscriptionError(err)) {
              await pushRepo.deleteByEndpointAnyTenant(sub.endpoint);
            } else {
              console.error(`Falha ao enviar push pro endpoint ${sub.endpoint}:`, err);
            }
          }
        }),
      );
    },
  };
}
