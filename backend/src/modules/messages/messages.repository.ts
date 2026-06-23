import { and, asc, count, desc, eq, or, sql } from 'drizzle-orm';
import type { db as Db } from '../../db/client.js';
import { messages } from '../../db/schema/index.js';
import { firstOrThrow } from '../../lib/firstOrThrow.js';
import type { Pagination } from '../../lib/pagination.js';

export interface CreateMessageInput {
  tenantId: string;
  senderId: string;
  receiverId: string;
  message: string;
}

function threadWhere(tenantId: string, userA: string, userB: string) {
  return and(
    eq(messages.tenantId, tenantId),
    or(and(eq(messages.senderId, userA), eq(messages.receiverId, userB)), and(eq(messages.senderId, userB), eq(messages.receiverId, userA))),
  );
}

export function createMessagesRepository(db: typeof Db) {
  return {
    async create(input: CreateMessageInput) {
      const rows = await db
        .insert(messages)
        .values({ tenantId: input.tenantId, senderId: input.senderId, receiverId: input.receiverId, message: input.message })
        .returning();
      return firstOrThrow(rows);
    },

    /** Usado pelo módulo de attachments pra checar se o auth é participante (sender ou receiver) antes de anexar/ler arquivo. */
    async findById(tenantId: string, id: string) {
      const [row] = await db.select().from(messages).where(and(eq(messages.tenantId, tenantId), eq(messages.id, id))).limit(1);
      return row ?? null;
    },

    async listThread(tenantId: string, userA: string, userB: string, pagination: Pagination) {
      const where = threadWhere(tenantId, userA, userB);

      const [rows, countRows] = await Promise.all([
        db.select().from(messages).where(where).orderBy(asc(messages.createdAt)).limit(pagination.limit).offset(pagination.offset),
        db.select({ value: count() }).from(messages).where(where),
      ]);

      return { rows, total: firstOrThrow(countRows).value };
    },

    /** Lê uma thread e marca como lidas as mensagens que o receiverId ainda não tinha visto. */
    async markThreadRead(tenantId: string, receiverId: string, senderId: string) {
      await db
        .update(messages)
        .set({ isRead: true })
        .where(and(eq(messages.tenantId, tenantId), eq(messages.receiverId, receiverId), eq(messages.senderId, senderId), eq(messages.isRead, false)));
    },

    /** Pra cada interlocutor com quem o usuário já trocou mensagem, devolve o id e a data da última troca. */
    async listCounterparts(tenantId: string, userId: string): Promise<{ counterpartId: string; lastAt: Date }[]> {
      const result = await db.execute<{ counterpart_id: string; last_at: Date }>(sql`
        SELECT CASE WHEN sender_id = ${userId} THEN receiver_id ELSE sender_id END AS counterpart_id,
               MAX(created_at) AS last_at
        FROM messages
        WHERE tenant_id = ${tenantId} AND (sender_id = ${userId} OR receiver_id = ${userId})
        GROUP BY counterpart_id
      `);
      return result.rows
        .map((r) => ({ counterpartId: r.counterpart_id, lastAt: new Date(r.last_at) }))
        .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
    },

    async lastMessageBetween(tenantId: string, userA: string, userB: string) {
      const [row] = await db.select().from(messages).where(threadWhere(tenantId, userA, userB)).orderBy(desc(messages.createdAt)).limit(1);
      return row ?? null;
    },

    async unreadCount(tenantId: string, receiverId: string, senderId: string) {
      const [row] = await db
        .select({ value: count() })
        .from(messages)
        .where(and(eq(messages.tenantId, tenantId), eq(messages.receiverId, receiverId), eq(messages.senderId, senderId), eq(messages.isRead, false)));
      return row?.value ?? 0;
    },
  };
}

export type MessagesRepository = ReturnType<typeof createMessagesRepository>;
