import { eq } from 'drizzle-orm';
import type { db as Db } from '../../db/client.js';
import { companySettings } from '../../db/schema/index.js';
import { firstOrThrow } from '../../lib/firstOrThrow.js';

export interface UpsertCompanySettingsInput {
  displayName?: string | null;
  logoUrl?: string | null;
  appName?: string | null;
  appSubtitle?: string | null;
  timezone?: string;
  locale?: string;
}

export function createCompanyRepository(db: typeof Db) {
  return {
    async findByTenant(tenantId: string) {
      const [row] = await db.select().from(companySettings).where(eq(companySettings.tenantId, tenantId)).limit(1);
      return row ?? null;
    },

    /** 1 linha por tenant — primeira escrita cria (usando os defaults da tabela pro que não foi enviado), as seguintes só atualizam o que veio. */
    async upsert(tenantId: string, input: UpsertCompanySettingsInput) {
      const rows = await db
        .insert(companySettings)
        .values({ tenantId, ...input })
        .onConflictDoUpdate({ target: companySettings.tenantId, set: { ...input, updatedAt: new Date() } })
        .returning();
      return firstOrThrow(rows);
    },
  };
}

export type CompanyRepository = ReturnType<typeof createCompanyRepository>;
