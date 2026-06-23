import type { db as Db } from '../../db/client.js';
import type { AuthContext } from '../../middleware/authenticate.js';
import { createCompanyRepository } from './company.repository.js';
import type { updateCompanySettingsSchema } from './company.schemas.js';
import type { z } from 'zod';

const DEFAULTS = { displayName: null, logoUrl: null, appName: null, appSubtitle: null, timezone: 'America/Sao_Paulo', locale: 'pt-BR' };

export function createCompanyService(db: typeof Db) {
  const repo = createCompanyRepository(db);

  return {
    /** Liberado a qualquer autenticado (GET) — sem linha ainda (tenant nunca configurou nada), devolve os defaults em vez de 404. */
    async get(auth: AuthContext) {
      const row = await repo.findByTenant(auth.tenantId);
      if (row) return row;
      return { tenantId: auth.tenantId, ...DEFAULTS, updatedAt: null };
    },

    /** RBAC (só admin) é checado na rota — aqui só persiste. */
    async update(auth: AuthContext, input: z.infer<typeof updateCompanySettingsSchema>) {
      return repo.upsert(auth.tenantId, {
        ...(input.display_name !== undefined ? { displayName: input.display_name } : {}),
        ...(input.logo_url !== undefined ? { logoUrl: input.logo_url } : {}),
        ...(input.app_name !== undefined ? { appName: input.app_name } : {}),
        ...(input.app_subtitle !== undefined ? { appSubtitle: input.app_subtitle } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.locale !== undefined ? { locale: input.locale } : {}),
      });
    },
  };
}

export type CompanyService = ReturnType<typeof createCompanyService>;
