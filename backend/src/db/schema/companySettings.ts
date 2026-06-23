import { pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { companies } from './companies';

/** Uma linha por tenant (tenant_id é PK e FK ao mesmo tempo) — cobre a permissão "Configurações
 * gerais" do Admin, que não tinha tabela correspondente.
 *
 * Dois grupos conceituais na mesma linha: "dados da empresa" (displayName/logoUrl — quem é o
 * tenant, só organizacional) e "dados do app" (appName/appSubtitle/timezone/locale — como o
 * produto se apresenta e se comporta pra esse tenant). appName/appSubtitle nulos == usa o nome
 * de marca padrão do produto ("CreatorsPro"/"OPERAÇÕES") — o fallback fica no frontend. */
export const companySettings = pgTable('company_settings', {
  tenantId: uuid('tenant_id').primaryKey().references(() => companies.id, { onDelete: 'cascade' }),
  displayName: varchar('display_name', { length: 255 }),
  logoUrl: text('logo_url'),
  appName: varchar('app_name', { length: 255 }),
  appSubtitle: varchar('app_subtitle', { length: 255 }),
  timezone: varchar('timezone', { length: 50 }).notNull().default('America/Sao_Paulo'),
  locale: varchar('locale', { length: 10 }).notNull().default('pt-BR'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
