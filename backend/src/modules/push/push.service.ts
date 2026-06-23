import type { db as Db } from '../../db/client.js';
import type { AuthContext } from '../../middleware/authenticate.js';
import { createPushSubscriptionsRepository } from './push.repository.js';
import type { subscribePushSchema } from './push.schemas.js';
import type { z } from 'zod';

export function createPushSubscriptionsService(db: typeof Db) {
  const repo = createPushSubscriptionsRepository(db);

  return {
    subscribe(auth: AuthContext, input: z.infer<typeof subscribePushSchema>) {
      return repo.upsert({
        tenantId: auth.tenantId,
        userId: auth.userId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
      });
    },

    unsubscribe(auth: AuthContext, endpoint: string) {
      return repo.deleteByEndpoint(auth.tenantId, endpoint);
    },
  };
}

export type PushSubscriptionsService = ReturnType<typeof createPushSubscriptionsService>;
