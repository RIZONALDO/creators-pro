import { alias } from 'drizzle-orm/pg-core';
import { and, asc, between, eq, gte, lte, sql } from 'drizzle-orm';
import type { db as Db } from '../../db/client.js';
import { creatorTasks, shifts, absences, clients, creators, collaborators, collaboratorServices, users } from '../../db/schema/index.js';

// `users` já é usado pro nome do creator/colaborador em cada listagem — precisa de um 2º alias
// pra resolver o nome de quem criou/aprovou (o "responsável"/gestor) na mesma query.
const responsibleUsers = alias(users, 'responsible_users');

export interface ReportFilter {
  clientId?: string;
  creatorId?: string;
}

export interface ServiceReportFilter {
  clientId?: string;
  collaboratorId?: string;
}

// count(*) volta bigint do Postgres — o driver pg devolveria string sem o cast pra int.
const countInt = sql<number>`count(*)::int`;

export function createReportsRepository(db: typeof Db) {
  return {
    async productionMonthly(tenantId: string, from: string, to: string, filter?: ReportFilter) {
      const conditions = [eq(creatorTasks.tenantId, tenantId), between(creatorTasks.taskDate, from, to)];
      if (filter?.clientId) conditions.push(eq(creatorTasks.clientId, filter.clientId));
      if (filter?.creatorId) conditions.push(eq(creatorTasks.creatorId, filter.creatorId));

      const month = sql<string>`to_char(${creatorTasks.taskDate}, 'YYYY-MM')`;
      return db
        .select({ month, count: countInt })
        .from(creatorTasks)
        .where(and(...conditions))
        .groupBy(month)
        .orderBy(month);
    },

    async productionByClient(tenantId: string, from: string, to: string, filter?: { creatorId?: string }) {
      const conditions = [eq(creatorTasks.tenantId, tenantId), between(creatorTasks.taskDate, from, to)];
      if (filter?.creatorId) conditions.push(eq(creatorTasks.creatorId, filter.creatorId));

      return db
        .select({ clientId: clients.id, clientName: clients.name, count: countInt })
        .from(creatorTasks)
        .innerJoin(clients, eq(creatorTasks.clientId, clients.id))
        .where(and(...conditions))
        .groupBy(clients.id, clients.name)
        .orderBy(sql`count(*) desc`);
    },

    /**
     * pedido na proposta original, ausente até hoje (nem no frontend mock).
     * Aceita `creatorId` mesmo agrupando por creator — não é redundante: é o que restringe a
     * consulta a um só creator quando quem está vendo é o próprio operacional (resolveScope), sem
     * isso ele veria a produção de todo mundo, só que agrupada.
     */
    async productionByCreator(tenantId: string, from: string, to: string, filter?: ReportFilter) {
      const conditions = [eq(creatorTasks.tenantId, tenantId), between(creatorTasks.taskDate, from, to)];
      if (filter?.clientId) conditions.push(eq(creatorTasks.clientId, filter.clientId));
      if (filter?.creatorId) conditions.push(eq(creatorTasks.creatorId, filter.creatorId));

      return db
        .select({ creatorId: creators.id, creatorName: users.name, count: countInt })
        .from(creatorTasks)
        .innerJoin(creators, eq(creatorTasks.creatorId, creators.id))
        .innerJoin(users, eq(creators.userId, users.id))
        .where(and(...conditions))
        .groupBy(creators.id, users.name)
        .orderBy(sql`count(*) desc`);
    },

    async shiftsCompleted(tenantId: string, from: string, to: string, filter?: { creatorId?: string }) {
      const conditions = [eq(shifts.tenantId, tenantId), eq(shifts.status, 'completed'), between(shifts.shiftDate, from, to)];
      if (filter?.creatorId) conditions.push(eq(shifts.creatorId, filter.creatorId));

      const byCreator = await db
        .select({ creatorId: creators.id, creatorName: users.name, count: countInt })
        .from(shifts)
        .innerJoin(creators, eq(shifts.creatorId, creators.id))
        .innerJoin(users, eq(creators.userId, users.id))
        .where(and(...conditions))
        .groupBy(creators.id, users.name)
        .orderBy(sql`count(*) desc`);

      return { total: byCreator.reduce((sum, r) => sum + r.count, 0), byCreator };
    },

    /** "absência no período" = sobrepõe [from, to] em algum dia, não precisa estar totalmente contida. */
    async absencesSummary(tenantId: string, from: string, to: string, filter?: { creatorId?: string }) {
      const conditions = [eq(absences.tenantId, tenantId), lte(absences.startDate, to), gte(absences.endDate, from)];
      if (filter?.creatorId) conditions.push(eq(absences.creatorId, filter.creatorId));

      const [byStatus, byCreator] = await Promise.all([
        db.select({ status: absences.status, count: countInt }).from(absences).where(and(...conditions)).groupBy(absences.status),
        db
          .select({ creatorId: creators.id, creatorName: users.name, count: countInt })
          .from(absences)
          .innerJoin(creators, eq(absences.creatorId, creators.id))
          .innerJoin(users, eq(creators.userId, users.id))
          .where(and(...conditions))
          .groupBy(creators.id, users.name)
          .orderBy(sql`count(*) desc`),
      ]);

      return { total: byStatus.reduce((sum, r) => sum + r.count, 0), byStatus, byCreator };
    },

    async approvedDeliveries(tenantId: string, from: string, to: string, filter?: ReportFilter) {
      const conditions = [eq(creatorTasks.tenantId, tenantId), between(creatorTasks.taskDate, from, to)];
      if (filter?.clientId) conditions.push(eq(creatorTasks.clientId, filter.clientId));
      if (filter?.creatorId) conditions.push(eq(creatorTasks.creatorId, filter.creatorId));

      const [row] = await db
        .select({
          total: countInt,
          approved: sql<number>`count(*) filter (where ${creatorTasks.status} = 'aprovado')::int`,
        })
        .from(creatorTasks)
        .where(and(...conditions));

      const total = row?.total ?? 0;
      const approved = row?.approved ?? 0;
      return { total, approved, rate: total > 0 ? approved / total : 0 };
    },

    /** Listagem completa (não agregada) de tarefas no período — pedido pra relatório em formato de planilha, não card de estatística. */
    async tasksListing(tenantId: string, from: string, to: string, filter?: ReportFilter) {
      const conditions = [eq(creatorTasks.tenantId, tenantId), between(creatorTasks.taskDate, from, to)];
      if (filter?.clientId) conditions.push(eq(creatorTasks.clientId, filter.clientId));
      if (filter?.creatorId) conditions.push(eq(creatorTasks.creatorId, filter.creatorId));

      return db
        .select({
          id: creatorTasks.id,
          title: creatorTasks.title,
          formatType: creatorTasks.formatType,
          taskDate: creatorTasks.taskDate,
          status: creatorTasks.status,
          description: creatorTasks.description,
          clientName: clients.name,
          creatorName: users.name,
          // quem criou a tarefa = o coordenador/gestor responsável por ela (specs/06 — created_by nunca vem do body).
          responsibleName: responsibleUsers.name,
        })
        .from(creatorTasks)
        .leftJoin(clients, eq(creatorTasks.clientId, clients.id))
        .leftJoin(creators, eq(creatorTasks.creatorId, creators.id))
        .leftJoin(users, eq(creators.userId, users.id))
        .leftJoin(responsibleUsers, eq(creatorTasks.createdBy, responsibleUsers.id))
        .where(and(...conditions))
        .orderBy(asc(creatorTasks.taskDate));
    },

    /** Mesma ideia de tasksListing, pra "outros serviços" (collaborator_services). */
    async servicesListing(tenantId: string, from: string, to: string, filter?: ServiceReportFilter) {
      const conditions = [eq(collaboratorServices.tenantId, tenantId), between(collaboratorServices.serviceDate, from, to)];
      if (filter?.clientId) conditions.push(eq(collaboratorServices.clientId, filter.clientId));
      if (filter?.collaboratorId) conditions.push(eq(collaboratorServices.collaboratorId, filter.collaboratorId));

      return db
        .select({
          id: collaboratorServices.id,
          serviceName: collaboratorServices.serviceName,
          serviceType: collaboratorServices.serviceType,
          serviceDate: collaboratorServices.serviceDate,
          status: collaboratorServices.status,
          notes: collaboratorServices.notes,
          clientName: clients.name,
          collaboratorName: users.name,
          responsibleName: responsibleUsers.name,
        })
        .from(collaboratorServices)
        .leftJoin(clients, eq(collaboratorServices.clientId, clients.id))
        .leftJoin(collaborators, eq(collaboratorServices.collaboratorId, collaborators.id))
        .leftJoin(users, eq(collaborators.userId, users.id))
        .leftJoin(responsibleUsers, eq(collaboratorServices.createdBy, responsibleUsers.id))
        .where(and(...conditions))
        .orderBy(asc(collaboratorServices.serviceDate));
    },

    /** Listagem completa de ausências no período (mesma regra de sobreposição de absencesSummary). */
    async absencesListing(tenantId: string, from: string, to: string, filter?: { creatorId?: string }) {
      const conditions = [eq(absences.tenantId, tenantId), lte(absences.startDate, to), gte(absences.endDate, from)];
      if (filter?.creatorId) conditions.push(eq(absences.creatorId, filter.creatorId));

      return db
        .select({
          id: absences.id,
          creatorName: users.name,
          startDate: absences.startDate,
          endDate: absences.endDate,
          reason: absences.reason,
          status: absences.status,
          approvedAt: absences.approvedAt,
          // ausência é solicitada pelo próprio creator — o "responsável" aqui é quem revisou (aprovou/rejeitou), não quem criou.
          responsibleName: responsibleUsers.name,
        })
        .from(absences)
        .leftJoin(creators, eq(absences.creatorId, creators.id))
        .leftJoin(users, eq(creators.userId, users.id))
        .leftJoin(responsibleUsers, eq(absences.approvedBy, responsibleUsers.id))
        .where(and(...conditions))
        .orderBy(asc(absences.startDate));
    },
  };
}

export type ReportsRepository = ReturnType<typeof createReportsRepository>;
