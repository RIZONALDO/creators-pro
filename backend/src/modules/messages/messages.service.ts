import type { db as Db } from '../../db/client.js';
import type { AuthContext } from '../../middleware/authenticate.js';
import { badRequest } from '../../lib/errors.js';
import type { Pagination } from '../../lib/pagination.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { createCreatorsRepository } from '../creators/creators.repository.js';
import { createNoopEmitter, type RealtimeEmitter } from '../../realtime/emitter.js';
import { createMessagesRepository } from './messages.repository.js';
import type { sendMessageSchema } from './messages.schemas.js';
import type { z } from 'zod';

const ALL_CONTACTS_PAGE = { page: 1, pageSize: 200, offset: 0, limit: 200 };

export function createMessagesService(db: typeof Db, emitter: RealtimeEmitter = createNoopEmitter()) {
  const messagesRepo = createMessagesRepository(db);
  const usersRepo = createUsersRepository(db);
  const creatorsRepo = createCreatorsRepository(db);

  return {
    /** REST (POST /messages) e o handler `message:send` do socket chamam este mesmo método — emissão de `message:new` nunca duplicada entre os dois. */
    async send(auth: AuthContext, input: z.infer<typeof sendMessageSchema>) {
      if (input.receiver_id === auth.userId) throw badRequest('CANNOT_MESSAGE_SELF', 'Não é possível enviar mensagem para si mesmo.');

      const receiver = await usersRepo.findByIdInTenant(auth.tenantId, input.receiver_id);
      if (!receiver) throw badRequest('INVALID_RECEIVER', 'Destinatário inválido para este tenant.');

      const created = await messagesRepo.create({ tenantId: auth.tenantId, senderId: auth.userId, receiverId: input.receiver_id, message: input.message });
      emitter.toUser(input.receiver_id, 'message:new', created);
      return created;
    },

    /**
     * Com quem dá pra começar uma conversa nova — `/conversations` só mostra quem já trocou
     * mensagem, então sem isto não haveria nenhum jeito de escolher um primeiro contato.
     * operacional não tem acesso a GET /creators nem /users (RBAC) — por isso é resolvido aqui,
     * já dentro do papel de cada um: operacional vê a coordenação, coordenador vê os creators.
     */
    async listContacts(auth: AuthContext) {
      if (auth.role === 'operacional') {
        const coordinators = await usersRepo.findByRoles(auth.tenantId, ['gestor', 'admin']);
        return coordinators.map((u) => ({ userId: u.id, name: u.name }));
      }
      const { rows } = await creatorsRepo.list(auth.tenantId, ALL_CONTACTS_PAGE);
      return rows.map((c) => ({ userId: c.userId, name: c.name }));
    },

    /** Ler a thread marca como lidas as mensagens recebidas nela — não existe endpoint dedicado de "marcar lida" pra mensagens. */
    async listThread(auth: AuthContext, withUserId: string, pagination: Pagination) {
      const counterpart = await usersRepo.findByIdInTenant(auth.tenantId, withUserId);
      if (!counterpart) throw badRequest('INVALID_RECEIVER', 'Usuário inválido para este tenant.');

      const { rows, total } = await messagesRepo.listThread(auth.tenantId, auth.userId, withUserId, pagination);
      await messagesRepo.markThreadRead(auth.tenantId, auth.userId, withUserId);
      return { rows, total };
    },

    // Nomes dos campos seguem o contrato já fixado em frontend/src/types.ts (Conversation) e no
    // mock (api/mock.ts) — user_id/last_message/last_at/unread, não nomes "óbvios" alternativos.
    async listConversations(auth: AuthContext) {
      const counterparts = await messagesRepo.listCounterparts(auth.tenantId, auth.userId);

      return Promise.all(
        counterparts.map(async ({ counterpartId }) => {
          const [lastMessage, unread] = await Promise.all([
            messagesRepo.lastMessageBetween(auth.tenantId, auth.userId, counterpartId),
            messagesRepo.unreadCount(auth.tenantId, auth.userId, counterpartId),
          ]);

          return {
            userId: counterpartId,
            lastMessage: lastMessage?.message ?? null,
            lastAt: lastMessage?.createdAt ?? null,
            unread,
          };
        }),
      );
    },
  };
}

export type MessagesService = ReturnType<typeof createMessagesService>;
