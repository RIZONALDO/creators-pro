import { and, count, desc, eq } from 'drizzle-orm';
import type { db as Db } from '../../db/client.js';
import { notifications, type NotificationType } from '../../db/schema/index.js';
import { firstOrThrow } from '../../lib/firstOrThrow.js';
import type { Pagination } from '../../lib/pagination.js';

export interface CreateNotificationInput {
  tenantId: string;
  userId: string;
  type: NotificationType;
  title: string;
  description?: string | null;
}

export function createNotificationsRepository(db: typeof Db) {
  return {
    async create(input: CreateNotificationInput) {
      const rows = await db
        .insert(notifications)
        .values({
          tenantId: input.tenantId,
          userId: input.userId,
          type: input.type,
          title: input.title,
          description: input.description ?? null,
        })
        .returning();
      return firstOrThrow(rows);
    },

    async list(tenantId: string, userId: string, pagination: Pagination) {
      const where = and(eq(notifications.tenantId, tenantId), eq(notifications.userId, userId));

      const [rows, countRows] = await Promise.all([
        db.select().from(notifications).where(where).orderBy(desc(notifications.createdAt)).limit(pagination.limit).offset(pagination.offset),
        db.select({ value: count() }).from(notifications).where(where),
      ]);

      return { rows, total: firstOrThrow(countRows).value };
    },

    async markAllRead(tenantId: string, userId: string) {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(and(eq(notifications.tenantId, tenantId), eq(notifications.userId, userId), eq(notifications.isRead, false)));
    },
  };
}

export type NotificationsRepository = ReturnType<typeof createNotificationsRepository>;
