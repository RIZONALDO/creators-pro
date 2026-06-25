import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import type { AccountService } from './account.service.js';

export function createAccountRouter(service: AccountService) {
  const router = Router();

  router.delete('/account', authenticate, authorize('admin'), async (req, res, next) => {
    try {
      await service.deleteAccount(req.auth!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
