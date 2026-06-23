import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { badRequest } from '../../lib/errors.js';
import { parsePagination, paginatedResponse } from '../../lib/pagination.js';
import type { MessagesService } from './messages.service.js';
import { sendMessageSchema } from './messages.schemas.js';

export function createMessagesRouter(service: MessagesService) {
  const router = Router();
  router.use(authenticate);

  router.get('/conversations', async (req, res, next) => {
    try {
      const conversations = await service.listConversations(req.auth!);
      res.json({ data: conversations });
    } catch (err) {
      next(err);
    }
  });

  router.get('/messages/contacts', async (req, res, next) => {
    try {
      const contacts = await service.listContacts(req.auth!);
      res.json({ data: contacts });
    } catch (err) {
      next(err);
    }
  });

  router.get('/messages', async (req, res, next) => {
    try {
      const withUserId = typeof req.query.with === 'string' ? req.query.with : undefined;
      if (!withUserId) throw badRequest('MISSING_WITH', 'Informe ?with=:userId.');

      const pagination = parsePagination(req);
      const { rows, total } = await service.listThread(req.auth!, withUserId, pagination);
      res.json(paginatedResponse(rows, total, pagination));
    } catch (err) {
      next(err);
    }
  });

  router.post('/messages', async (req, res, next) => {
    try {
      const input = sendMessageSchema.parse(req.body);
      const message = await service.send(req.auth!, input);
      res.status(201).json(message);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
