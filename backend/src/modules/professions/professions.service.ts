import { and, eq, isNotNull } from 'drizzle-orm';
import type { db as Db } from '../../db/client.js';
import { collaborators } from '../../db/schema/index.js';
import { DEFAULT_PROFESSIONS } from './professions.constants.js';

export function createProfessionsService(db: typeof Db) {
  return {
    async list(tenantId: string): Promise<string[]> {
      const rows = await db
        .selectDistinct({ profession: collaborators.profession })
        .from(collaborators)
        .where(and(eq(collaborators.tenantId, tenantId), isNotNull(collaborators.profession)));

      const used = rows.map((r) => r.profession).filter((p): p is string => Boolean(p));
      return Array.from(new Set([...DEFAULT_PROFESSIONS, ...used]));
    },

    // Não persiste em tabela própria (profession é VARCHAR em collaborators) — só eco pro autocomplete, ver specs/04.
    async create(name: string): Promise<{ name: string }> {
      return { name };
    },
  };
}

export type ProfessionsService = ReturnType<typeof createProfessionsService>;
