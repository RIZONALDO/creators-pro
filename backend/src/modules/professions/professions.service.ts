import { and, asc, eq } from 'drizzle-orm';
import type { db as Db } from '../../db/client.js';
import { professions } from '../../db/schema/index.js';
import { firstOrThrow } from '../../lib/firstOrThrow.js';
import { notFound } from '../../lib/errors.js';

export function createProfessionsService(db: typeof Db) {
  return {
    async list(tenantId: string): Promise<{ id: string; name: string; created_at: string }[]> {
      const rows = await db.select().from(professions).where(eq(professions.tenantId, tenantId)).orderBy(asc(professions.name));
      return rows.map((r) => ({ id: r.id, name: r.name, created_at: r.createdAt.toISOString() }));
    },

    async create(tenantId: string, name: string): Promise<{ id: string; name: string }> {
      const rows = await db.insert(professions).values({ tenantId, name: name.trim() }).returning();
      const row = firstOrThrow(rows);
      return { id: row.id, name: row.name };
    },

    async remove(tenantId: string, id: string): Promise<void> {
      const rows = await db.delete(professions).where(and(eq(professions.tenantId, tenantId), eq(professions.id, id))).returning();
      if (rows.length === 0) throw notFound('PROFESSION_NOT_FOUND', 'Profissão não encontrada.');
    },
  };
}

export type ProfessionsService = ReturnType<typeof createProfessionsService>;
