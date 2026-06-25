import { eq } from 'drizzle-orm';
import type { db as Db } from '../../db/client.js';
import type { AuthContext } from '../../middleware/authenticate.js';
import { conflict, notFound } from '../../lib/errors.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import {
  absences, attachments, clients, collaborators, collaboratorServices, companies, companySettings,
  creators, creatorTasks, holidays, messages, notifications, pushSubscriptions, refreshTokens,
  scaleEntries, scaleMonths, shiftStandbys, shifts, statusHistory, users,
} from '../../db/schema/index.js';

export function createAccountService(db: typeof Db) {
  const companiesRepo = createCompaniesRepository(db);

  return {
    /** Empresa + tudo que ela tem (creators, tarefas, escala, mensagens...) — permanente, sem
     * volta. Só liberado em 'trial': quem já paga cancela pelo portal da Stripe (assertura de
     * pagamento ativo merece o fluxo de cancelamento de verdade, não um botão de apagar tudo —
     * ver AdminAccount.tsx). Ordem de DELETE respeita as FKs (a maioria é onDelete: 'restrict' de
     * propósito, pra nenhum outro código apagar uma empresa por acidente — ver schema/*.ts).
     */
    async deleteAccount(auth: AuthContext) {
      const company = await companiesRepo.findById(auth.tenantId);
      if (!company) throw notFound('COMPANY_NOT_FOUND', 'Empresa não encontrada.');
      if (company.status !== 'trial') {
        throw conflict('ACCOUNT_DELETE_NOT_ALLOWED', 'Excluir a conta só é possível durante o período de teste. Pra cancelar um plano ativo, use o portal de cobrança.');
      }

      const t = auth.tenantId;
      await db.transaction(async (tx) => {
        await tx.delete(attachments).where(eq(attachments.tenantId, t));
        await tx.delete(messages).where(eq(messages.tenantId, t));
        await tx.delete(notifications).where(eq(notifications.tenantId, t));
        await tx.delete(pushSubscriptions).where(eq(pushSubscriptions.tenantId, t));
        await tx.delete(statusHistory).where(eq(statusHistory.tenantId, t));
        await tx.delete(collaboratorServices).where(eq(collaboratorServices.tenantId, t));
        await tx.delete(creatorTasks).where(eq(creatorTasks.tenantId, t));
        await tx.delete(scaleEntries).where(eq(scaleEntries.tenantId, t));
        await tx.delete(shiftStandbys).where(eq(shiftStandbys.tenantId, t));
        await tx.delete(absences).where(eq(absences.tenantId, t));
        await tx.delete(refreshTokens).where(eq(refreshTokens.tenantId, t));
        await tx.delete(scaleMonths).where(eq(scaleMonths.tenantId, t));
        await tx.delete(shifts).where(eq(shifts.tenantId, t));
        await tx.delete(clients).where(eq(clients.tenantId, t));
        await tx.delete(creators).where(eq(creators.tenantId, t));
        await tx.delete(collaborators).where(eq(collaborators.tenantId, t));
        await tx.delete(companySettings).where(eq(companySettings.tenantId, t));
        await tx.delete(holidays).where(eq(holidays.tenantId, t));
        await tx.delete(users).where(eq(users.tenantId, t));
        await tx.delete(companies).where(eq(companies.id, t));
      });
    },
  };
}

export type AccountService = ReturnType<typeof createAccountService>;
