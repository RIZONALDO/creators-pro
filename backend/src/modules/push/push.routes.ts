import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import type { PushSubscriptionsService } from './push.service.js';
import { subscribePushSchema, unsubscribePushSchema } from './push.schemas.js';

export function createPushRouter(service: PushSubscriptionsService, vapidPublicKey: string | undefined) {
  const router = Router();
  router.use('/push', authenticate);

  // null quando o servidor não tem VAPID configurado — o frontend trata isso como "push indisponível".
  router.get('/push/vapid-public-key', (_req, res) => {
    res.json({ data: { public_key: vapidPublicKey || null } });
  });

  router.post('/push/subscribe', async (req, res, next) => {
    try {
      const input = subscribePushSchema.parse(req.body);
      await service.subscribe(req.auth!, input);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  router.post('/push/unsubscribe', async (req, res, next) => {
    try {
      const { endpoint } = unsubscribePushSchema.parse(req.body);
      await service.unsubscribe(req.auth!, endpoint);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
