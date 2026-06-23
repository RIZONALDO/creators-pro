import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../middleware/authenticate.js';
import { badRequest } from '../../lib/errors.js';
import { attachmentEntityRefSchema } from './attachments.schemas.js';
import type { AttachmentsService } from './attachments.service.js';

// memoryStorage: o buffer vai pro service (que decide onde/como persistir, hoje disco local via lib/localStorage.js)
// — a rota não sabe de storage, só de HTTP, mesmo desenho de não vazar detalhe de infra pra fora do service.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

export function createAttachmentsRouter(service: AttachmentsService) {
  const router = Router();
  router.use('/attachments', authenticate);

  router.post('/attachments', upload.single('file'), async (req, res, next) => {
    try {
      if (!req.file) throw badRequest('FILE_REQUIRED', 'Nenhum arquivo enviado.');
      const input = attachmentEntityRefSchema.parse({ entity_type: req.body.entity_type, entity_id: req.body.entity_id });
      const attachment = await service.upload(req.auth!, {
        entityType: input.entity_type,
        entityId: input.entity_id,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype || null,
        buffer: req.file.buffer,
      });
      res.status(201).json({ data: attachment });
    } catch (err) {
      next(err);
    }
  });

  router.get('/attachments', async (req, res, next) => {
    try {
      const input = attachmentEntityRefSchema.parse({ entity_type: req.query.entity_type, entity_id: req.query.entity_id });
      const rows = await service.listForEntity(req.auth!, input.entity_type, input.entity_id);
      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  });

  // Não é express.static: precisa do auth + checagem de acesso à entidade dona antes de devolver o byte.
  router.get('/attachments/:id/file', async (req, res, next) => {
    try {
      const { attachment, buffer } = await service.getFile(req.auth!, req.params.id);
      res.setHeader('Content-Type', attachment.mimeType ?? 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.fileName ?? 'arquivo')}"`);
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/attachments/:id', async (req, res, next) => {
    try {
      await service.remove(req.auth!, req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
