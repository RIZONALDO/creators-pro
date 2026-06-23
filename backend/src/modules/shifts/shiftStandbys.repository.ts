import { and, eq, inArray } from 'drizzle-orm';
import type { db as Db } from '../../db/client.js';
import { shiftStandbys } from '../../db/schema/index.js';

export function createShiftStandbysRepository(db: typeof Db) {
  return {
    async listByShiftIds(tenantId: string, shiftIds: string[]) {
      if (shiftIds.length === 0) return [];
      return db.select().from(shiftStandbys).where(and(eq(shiftStandbys.tenantId, tenantId), inArray(shiftStandbys.shiftId, shiftIds)));
    },

    /** Substitui a lista completa de sobreaviso de um plantão (delete + insert). */
    async setStandbys(tenantId: string, shiftId: string, creatorIds: string[]) {
      await db.delete(shiftStandbys).where(and(eq(shiftStandbys.tenantId, tenantId), eq(shiftStandbys.shiftId, shiftId)));
      if (creatorIds.length === 0) return [];
      return db.insert(shiftStandbys).values(creatorIds.map((creatorId) => ({ tenantId, shiftId, creatorId }))).returning();
    },
  };
}

export type ShiftStandbysRepository = ReturnType<typeof createShiftStandbysRepository>;
