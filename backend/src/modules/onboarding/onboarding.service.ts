import { and, count, eq } from 'drizzle-orm';
import type { db as Db } from '../../db/client.js';
import type { AuthContext } from '../../middleware/authenticate.js';
import { users, creators, creatorTasks, scaleEntries } from '../../db/schema/index.js';

export function createOnboardingService(db: typeof Db) {
  return {
    /** 4 counts em paralelo — sem join, sem row fetch, só contadores.
     * O frontend decide quais passos mostrar por role (gestores não podem adicionar gestores,
     * por isso `has_gestor` vem separado e o cliente filtra). */
    async getStatus(auth: AuthContext) {
      const tid = auth.tenantId;
      const [gestorRows, creatorRows, taskRows, scaleRows] = await Promise.all([
        db.select({ n: count() }).from(users).where(and(eq(users.tenantId, tid), eq(users.role, 'gestor'))),
        db.select({ n: count() }).from(creators).where(eq(creators.tenantId, tid)),
        db.select({ n: count() }).from(creatorTasks).where(eq(creatorTasks.tenantId, tid)),
        db.select({ n: count() }).from(scaleEntries).where(eq(scaleEntries.tenantId, tid)),
      ]);

      return {
        has_gestor: (gestorRows[0]?.n ?? 0) > 0,
        has_creator: (creatorRows[0]?.n ?? 0) > 0,
        has_task: (taskRows[0]?.n ?? 0) > 0,
        has_scale_entry: (scaleRows[0]?.n ?? 0) > 0,
      };
    },
  };
}

export type OnboardingService = ReturnType<typeof createOnboardingService>;
