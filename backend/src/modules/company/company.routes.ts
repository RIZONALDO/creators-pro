import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { updateCompanySettingsSchema } from './company.schemas.js';
import type { CompanyService } from './company.service.js';

export function createCompanyRouter(service: CompanyService) {
  const router = Router();
  router.use('/company', authenticate);

  // qualquer usuário autenticado precisa do nome/logo da empresa pra UI (specs/04).
  router.get('/company/settings', async (req, res, next) => {
    try {
      const data = await service.get(req.auth!);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  });

  router.put('/company/settings', authorize('admin'), async (req, res, next) => {
    try {
      const input = updateCompanySettingsSchema.parse(req.body);
      const data = await service.update(req.auth!, input);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
