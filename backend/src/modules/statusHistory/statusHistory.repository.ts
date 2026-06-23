import { and, asc, eq } from 'drizzle-orm';
import type { db as Db } from '../../db/client.js';
import { statusHistory, type HistoryEntity } from '../../db/schema/index.js';
import { firstOrThrow } from '../../lib/firstOrThrow.js';

export interface RecordStatusChangeInput {
  tenantId: string;
  entityType: HistoryEntity;
  entityId: string;
  oldStatus: string | null;
  newStatus: string;
  changedBy: string;
}

export function createStatusHistoryRepository(db: typeof Db) {
  return {
    async record(input: RecordStatusChangeInput) {
      const rows = await db
        .insert(statusHistory)
        .values({
          tenantId: input.tenantId,
          entityType: input.entityType,
          entityId: input.entityId,
          oldStatus: input.oldStatus,
          newStatus: input.newStatus,
          changedBy: input.changedBy,
        })
        .returning();
      return firstOrThrow(rows);
    },

    async list(tenantId: string, entityType: HistoryEntity, entityId: string) {
      return db
        .select()
        .from(statusHistory)
        .where(and(eq(statusHistory.tenantId, tenantId), eq(statusHistory.entityType, entityType), eq(statusHistory.entityId, entityId)))
        .orderBy(asc(statusHistory.changedAt));
    },

    /** Usado antes de apagar a entidade dona — status_history é polimórfica, sem FK real apontando pra ela. */
    async deleteForEntity(tenantId: string, entityType: HistoryEntity, entityId: string) {
      await db
        .delete(statusHistory)
        .where(and(eq(statusHistory.tenantId, tenantId), eq(statusHistory.entityType, entityType), eq(statusHistory.entityId, entityId)));
    },
  };
}

export type StatusHistoryRepository = ReturnType<typeof createStatusHistoryRepository>;
