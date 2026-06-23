import { and, eq } from 'drizzle-orm';
import type { db as Db } from '../../db/client.js';
import { pushSubscriptions } from '../../db/schema/index.js';
import { firstOrThrow } from '../../lib/firstOrThrow.js';

export interface UpsertPushSubscriptionInput {
  tenantId: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export function createPushSubscriptionsRepository(db: typeof Db) {
  return {
    /** endpoint é único globalmente (1 navegador/dispositivo) — re-inscrever (ou outro usuário no mesmo navegador) atualiza a linha. */
    async upsert(input: UpsertPushSubscriptionInput) {
      const rows = await db
        .insert(pushSubscriptions)
        .values({ tenantId: input.tenantId, userId: input.userId, endpoint: input.endpoint, p256dh: input.p256dh, auth: input.auth })
        .onConflictDoUpdate({
          target: pushSubscriptions.endpoint,
          set: { tenantId: input.tenantId, userId: input.userId, p256dh: input.p256dh, auth: input.auth },
        })
        .returning();
      return firstOrThrow(rows);
    },

    async listByUser(tenantId: string, userId: string) {
      return db.select().from(pushSubscriptions).where(and(eq(pushSubscriptions.tenantId, tenantId), eq(pushSubscriptions.userId, userId)));
    },

    async deleteByEndpoint(tenantId: string, endpoint: string) {
      await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.tenantId, tenantId), eq(pushSubscriptions.endpoint, endpoint)));
    },

    /** Usado pelo PushSender quando o serviço de push devolve 404/410 (endpoint morto) — sem tenant à mão nesse ponto. */
    async deleteByEndpointAnyTenant(endpoint: string) {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
    },
  };
}

export type PushSubscriptionsRepository = ReturnType<typeof createPushSubscriptionsRepository>;
