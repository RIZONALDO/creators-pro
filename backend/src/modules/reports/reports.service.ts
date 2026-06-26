import type { db as Db } from '../../db/client.js';
import type { AuthContext } from '../../middleware/authenticate.js';
import { badRequest } from '../../lib/errors.js';
import { createCreatorsRepository } from '../creators/creators.repository.js';
import { createReportsRepository } from './reports.repository.js';
import type { exportReportSchema, reportFilterSchema, serviceReportFilterSchema } from './reports.schemas.js';
import type { z } from 'zod';

type ReportInput = z.infer<typeof reportFilterSchema>;
type ServiceReportInput = z.infer<typeof serviceReportFilterSchema>;
type ExportInput = z.infer<typeof exportReportSchema>;
interface Scope { from: string; to: string; clientId?: string; creatorId?: string; }
interface ServiceScope { from: string; to: string; clientId?: string; collaboratorId?: string; }

export function createReportsService(db: typeof Db) {
  const repo = createReportsRepository(db);
  const creatorsRepo = createCreatorsRepository(db);

  async function resolveScope(auth: AuthContext, input: ReportInput): Promise<Scope | null> {
    if (input.to < input.from) throw badRequest('INVALID_DATE_RANGE', '"to" não pode ser anterior a "from".');
    if (auth.role !== 'operacional') return input;
    const own = await creatorsRepo.findRowByUserId(auth.tenantId, auth.userId);
    if (!own) return null;
    return { ...input, creatorId: own.id };
  }

  async function resolveServiceScope(_auth: AuthContext, input: ServiceReportInput): Promise<ServiceScope> {
    if (input.to < input.from) throw badRequest('INVALID_DATE_RANGE', '"to" não pode ser anterior a "from".');
    return input;
  }

  /** Listagem completa (não agregada) — relatório em formato de planilha, não card de estatística. */
  async function tasksListing(auth: AuthContext, input: ReportInput) {
    const scope = await resolveScope(auth, input);
    return scope ? repo.tasksListing(auth.tenantId, scope.from, scope.to, scope) : [];
  }

  async function servicesListing(auth: AuthContext, input: ServiceReportInput) {
    const scope = await resolveServiceScope(auth, input);
    return repo.servicesListing(auth.tenantId, scope.from, scope.to, scope);
  }

  async function absencesListing(auth: AuthContext, input: ReportInput) {
    const scope = await resolveScope(auth, input);
    return scope ? repo.absencesListing(auth.tenantId, scope.from, scope.to, scope) : [];
  }

  return {
    async productionMonthly(auth: AuthContext, input: ReportInput) {
      const scope = await resolveScope(auth, input);
      return scope ? repo.productionMonthly(auth.tenantId, scope.from, scope.to, scope) : [];
    },

    async productionByClient(auth: AuthContext, input: ReportInput) {
      const scope = await resolveScope(auth, input);
      return scope ? repo.productionByClient(auth.tenantId, scope.from, scope.to, scope) : [];
    },

    async productionByCreator(auth: AuthContext, input: ReportInput) {
      const scope = await resolveScope(auth, input);
      return scope ? repo.productionByCreator(auth.tenantId, scope.from, scope.to, scope) : [];
    },

    async shiftsCompleted(auth: AuthContext, input: ReportInput) {
      const scope = await resolveScope(auth, input);
      return scope ? repo.shiftsCompleted(auth.tenantId, scope.from, scope.to, scope) : { total: 0, byCreator: [] };
    },

    async absencesSummary(auth: AuthContext, input: ReportInput) {
      const scope = await resolveScope(auth, input);
      return scope ? repo.absencesSummary(auth.tenantId, scope.from, scope.to, scope) : { total: 0, byStatus: [], byCreator: [] };
    },

    async approvedDeliveries(auth: AuthContext, input: ReportInput) {
      const scope = await resolveScope(auth, input);
      return scope ? repo.approvedDeliveries(auth.tenantId, scope.from, scope.to, scope) : { total: 0, approved: 0, rate: 0 };
    },

    tasksListing,
    servicesListing,
    absencesListing,

    /** Mesmo dado das funções acima — type escolhe qual, pra /reports/export (exceto 'all', ver exportAllData). */
    async exportData(auth: AuthContext, input: Exclude<ExportInput, { type: 'all' }>) {
      if (input.type === 'services') {
        const scope = await resolveServiceScope(auth, input);
        return scope ? repo.servicesListing(auth.tenantId, scope.from, scope.to, scope) : [];
      }

      const scope = await resolveScope(auth, input);
      if (!scope) return [];
      if (input.type === 'monthly') return repo.productionMonthly(auth.tenantId, scope.from, scope.to, scope);
      if (input.type === 'client') return repo.productionByClient(auth.tenantId, scope.from, scope.to, scope);
      if (input.type === 'creator') return repo.productionByCreator(auth.tenantId, scope.from, scope.to, scope);
      if (input.type === 'tasks') return repo.tasksListing(auth.tenantId, scope.from, scope.to, scope);
      return repo.absencesListing(auth.tenantId, scope.from, scope.to, scope);
    },

    /** type=all — as 3 listagens completas juntas (1 seção por dataset), pra export/impressão combinada. */
    async exportAllData(auth: AuthContext, input: ReportInput) {
      const [tasksRows, servicesRows, absencesRows] = await Promise.all([
        tasksListing(auth, input),
        servicesListing(auth, { from: input.from, to: input.to, clientId: input.clientId }),
        absencesListing(auth, input),
      ]);
      return [
        { type: 'tasks' as const, rows: tasksRows },
        { type: 'services' as const, rows: servicesRows },
        { type: 'absences' as const, rows: absencesRows },
      ];
    },
  };
}

export type ReportsService = ReturnType<typeof createReportsService>;
