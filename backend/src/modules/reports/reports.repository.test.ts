import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { createCreatorsRepository } from '../creators/creators.repository.js';
import { createClientsRepository } from '../clients/clients.repository.js';
import { createTasksRepository } from '../tasks/tasks.repository.js';
import { createShiftsRepository } from '../shifts/shifts.repository.js';
import { createAbsencesRepository } from '../absences/absences.repository.js';
import { createCollaboratorsRepository } from '../collaborators/collaborators.repository.js';
import { createServicesRepository } from '../services/services.repository.js';
import { createReportsRepository } from './reports.repository.js';

describe('reportsRepository (seed determinístico)', () => {
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);
  const creatorsRepo = createCreatorsRepository(testDb);
  const clientsRepo = createClientsRepository(testDb);
  const tasksRepo = createTasksRepository(testDb);
  const shiftsRepo = createShiftsRepository(testDb);
  const absencesRepo = createAbsencesRepository(testDb);
  const collaboratorsRepo = createCollaboratorsRepository(testDb);
  const servicesRepo = createServicesRepository(testDb);
  const reportsRepo = createReportsRepository(testDb);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  async function setupTenant() {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const gestor = await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: 'g@acme.com', passwordHash: 'hash', role: 'gestor' });
    const creatorAUser = await usersRepo.create({ tenantId: company.id, name: 'Creator A', email: 'a@acme.com', passwordHash: 'hash', role: 'operacional' });
    const creatorA = await creatorsRepo.createRow({ tenantId: company.id, userId: creatorAUser.id, employmentType: 'fixed' });
    const creatorBUser = await usersRepo.create({ tenantId: company.id, name: 'Creator B', email: 'b@acme.com', passwordHash: 'hash', role: 'operacional' });
    const creatorB = await creatorsRepo.createRow({ tenantId: company.id, userId: creatorBUser.id, employmentType: 'fixed' });
    const client = await clientsRepo.create(company.id, { name: 'Cliente X' });
    return { company, gestor, creatorA, creatorB, client };
  }

  it('productionMonthly agrupa por mês e soma exato', async () => {
    const { company, gestor, creatorA, client } = await setupTenant();
    await tasksRepo.create({ tenantId: company.id, title: 'T1', taskDate: '2026-05-10', creatorId: creatorA.id, clientId: client.id, createdBy: gestor.id });
    await tasksRepo.create({ tenantId: company.id, title: 'T2', taskDate: '2026-05-20', creatorId: creatorA.id, clientId: client.id, createdBy: gestor.id });
    await tasksRepo.create({ tenantId: company.id, title: 'T3', taskDate: '2026-06-05', creatorId: creatorA.id, clientId: client.id, createdBy: gestor.id });
    // fora do range — não deve contar
    await tasksRepo.create({ tenantId: company.id, title: 'T4-fora', taskDate: '2026-01-01', creatorId: creatorA.id, clientId: client.id, createdBy: gestor.id });

    const rows = await reportsRepo.productionMonthly(company.id, '2026-05-01', '2026-06-30');
    expect(rows).toEqual([
      { month: '2026-05', count: 2 },
      { month: '2026-06', count: 1 },
    ]);
  });

  it('productionByClient soma por cliente, ignora tarefa de outro cliente', async () => {
    const { company, gestor, creatorA, client } = await setupTenant();
    const otherClient = await clientsRepo.create(company.id, { name: 'Cliente Y' });
    await tasksRepo.create({ tenantId: company.id, title: 'T1', taskDate: '2026-06-10', creatorId: creatorA.id, clientId: client.id, createdBy: gestor.id });
    await tasksRepo.create({ tenantId: company.id, title: 'T2', taskDate: '2026-06-11', creatorId: creatorA.id, clientId: client.id, createdBy: gestor.id });
    await tasksRepo.create({ tenantId: company.id, title: 'T3', taskDate: '2026-06-12', creatorId: creatorA.id, clientId: otherClient.id, createdBy: gestor.id });

    const rows = await reportsRepo.productionByClient(company.id, '2026-06-01', '2026-06-30');
    expect(rows).toEqual(expect.arrayContaining([
      { clientId: client.id, clientName: 'Cliente X', count: 2 },
      { clientId: otherClient.id, clientName: 'Cliente Y', count: 1 },
    ]));
    expect(rows).toHaveLength(2);
  });

  it('productionByCreator (gatilho novo, pedido na proposta original) soma por creator', async () => {
    const { company, gestor, creatorA, creatorB, client } = await setupTenant();
    await tasksRepo.create({ tenantId: company.id, title: 'T1', taskDate: '2026-06-10', creatorId: creatorA.id, clientId: client.id, createdBy: gestor.id });
    await tasksRepo.create({ tenantId: company.id, title: 'T2', taskDate: '2026-06-11', creatorId: creatorB.id, clientId: client.id, createdBy: gestor.id });
    await tasksRepo.create({ tenantId: company.id, title: 'T3', taskDate: '2026-06-12', creatorId: creatorB.id, clientId: client.id, createdBy: gestor.id });

    const rows = await reportsRepo.productionByCreator(company.id, '2026-06-01', '2026-06-30');
    expect(rows).toEqual(expect.arrayContaining([
      { creatorId: creatorA.id, creatorName: 'Creator A', count: 1 },
      { creatorId: creatorB.id, creatorName: 'Creator B', count: 2 },
    ]));
  });

  it('shiftsCompleted conta só status=completed, dentro do range', async () => {
    const { company, gestor, creatorA, creatorB } = await setupTenant();
    const s1 = await shiftsRepo.create({ tenantId: company.id, shiftDate: '2026-06-06', creatorId: creatorA.id, createdBy: gestor.id });
    await shiftsRepo.updateStatus(company.id, s1.id, 'completed');
    const s2 = await shiftsRepo.create({ tenantId: company.id, shiftDate: '2026-06-13', creatorId: creatorA.id, createdBy: gestor.id });
    await shiftsRepo.updateStatus(company.id, s2.id, 'completed');
    const s3 = await shiftsRepo.create({ tenantId: company.id, shiftDate: '2026-06-20', creatorId: creatorB.id, createdBy: gestor.id });
    await shiftsRepo.updateStatus(company.id, s3.id, 'completed');
    // ainda pending — não deve contar
    await shiftsRepo.create({ tenantId: company.id, shiftDate: '2026-06-27', creatorId: creatorB.id, createdBy: gestor.id });

    const result = await reportsRepo.shiftsCompleted(company.id, '2026-06-01', '2026-06-30');
    expect(result.total).toBe(3);
    expect(result.byCreator).toEqual(expect.arrayContaining([
      { creatorId: creatorA.id, creatorName: 'Creator A', count: 2 },
      { creatorId: creatorB.id, creatorName: 'Creator B', count: 1 },
    ]));
  });

  it('absencesSummary conta por status e por creator, considerando sobreposição de período', async () => {
    const { company, gestor, creatorA, creatorB } = await setupTenant();
    const a1 = await absencesRepo.create({ tenantId: company.id, creatorId: creatorA.id, startDate: '2026-06-05', endDate: '2026-06-07' });
    await absencesRepo.review(company.id, a1.id, 'approved', gestor.id);
    const a2 = await absencesRepo.create({ tenantId: company.id, creatorId: creatorB.id, startDate: '2026-06-20', endDate: '2026-06-22' });
    await absencesRepo.review(company.id, a2.id, 'rejected', gestor.id);
    // começa antes do range mas termina dentro — sobrepõe, deve contar
    await absencesRepo.create({ tenantId: company.id, creatorId: creatorA.id, startDate: '2026-05-28', endDate: '2026-06-02' });
    // totalmente fora do range — não deve contar
    await absencesRepo.create({ tenantId: company.id, creatorId: creatorB.id, startDate: '2026-08-01', endDate: '2026-08-03' });

    const result = await reportsRepo.absencesSummary(company.id, '2026-06-01', '2026-06-30');
    expect(result.total).toBe(3);
    expect(result.byStatus).toEqual(expect.arrayContaining([
      { status: 'approved', count: 1 },
      { status: 'rejected', count: 1 },
      { status: 'pending', count: 1 },
    ]));
  });

  it('approvedDeliveries calcula total/aprovado/taxa exatos', async () => {
    const { company, gestor, creatorA, client } = await setupTenant();
    const t1 = await tasksRepo.create({ tenantId: company.id, title: 'T1', taskDate: '2026-06-10', creatorId: creatorA.id, clientId: client.id, createdBy: gestor.id });
    await tasksRepo.updateStatus(company.id, t1.id, 'aprovado');
    const t2 = await tasksRepo.create({ tenantId: company.id, title: 'T2', taskDate: '2026-06-11', creatorId: creatorA.id, clientId: client.id, createdBy: gestor.id });
    await tasksRepo.updateStatus(company.id, t2.id, 'aprovado');
    await tasksRepo.create({ tenantId: company.id, title: 'T3', taskDate: '2026-06-12', creatorId: creatorA.id, clientId: client.id, createdBy: gestor.id }); // na_fila

    const result = await reportsRepo.approvedDeliveries(company.id, '2026-06-01', '2026-06-30');
    expect(result).toEqual({ total: 3, approved: 2, rate: 2 / 3 });
  });

  it('tasksListing devolve linhas completas (não agregadas), com nomes resolvidos, dentro do range', async () => {
    const { company, gestor, creatorA, client } = await setupTenant();
    await tasksRepo.create({ tenantId: company.id, title: 'Reels institucional', formatType: 'Reels', taskDate: '2026-06-10', creatorId: creatorA.id, clientId: client.id, createdBy: gestor.id });
    await tasksRepo.create({ tenantId: company.id, title: 'Fora do range', taskDate: '2026-01-01', creatorId: creatorA.id, clientId: client.id, createdBy: gestor.id });

    const rows = await reportsRepo.tasksListing(company.id, '2026-06-01', '2026-06-30');
    expect(rows).toHaveLength(1);
    // responsibleName = quem criou a tarefa (created_by) — o coordenador/gestor que liderou, não o creator que executa.
    expect(rows[0]).toMatchObject({ title: 'Reels institucional', formatType: 'Reels', taskDate: '2026-06-10', clientName: 'Cliente X', creatorName: 'Creator A', responsibleName: 'Gestora', status: 'na_fila' });
  });

  it('servicesListing devolve linhas completas de "outros serviços", com nome do colaborador resolvido', async () => {
    const { company, gestor, client } = await setupTenant();
    const colab = await collaboratorsRepo.createRow({ tenantId: company.id, name: 'Colaborador A', profession: 'Editor', employmentType: 'freelancer' });
    await servicesRepo.create({ tenantId: company.id, serviceName: 'Captação aérea', serviceType: 'drone', serviceDate: '2026-06-15', collaboratorId: colab.id, clientId: client.id, createdBy: gestor.id });

    const rows = await reportsRepo.servicesListing(company.id, '2026-06-01', '2026-06-30');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ serviceName: 'Captação aérea', serviceType: 'drone', serviceDate: '2026-06-15', clientName: 'Cliente X', collaboratorName: 'Colaborador A', responsibleName: 'Gestora', status: 'agendado' });
  });

  it('absencesListing devolve linhas completas, considerando sobreposição de período; sem revisão ainda, responsibleName é null', async () => {
    const { company, creatorA } = await setupTenant();
    await absencesRepo.create({ tenantId: company.id, creatorId: creatorA.id, startDate: '2026-06-05', endDate: '2026-06-07', reason: 'Consulta médica' });
    await absencesRepo.create({ tenantId: company.id, creatorId: creatorA.id, startDate: '2026-08-01', endDate: '2026-08-03' }); // fora do range

    const rows = await reportsRepo.absencesListing(company.id, '2026-06-01', '2026-06-30');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ creatorName: 'Creator A', startDate: '2026-06-05', endDate: '2026-06-07', reason: 'Consulta médica', responsibleName: null, status: 'pending' });
  });

  it('absencesListing: depois de revisada, responsibleName é o gestor que aprovou/rejeitou (approved_by)', async () => {
    const { company, gestor, creatorA } = await setupTenant();
    const a = await absencesRepo.create({ tenantId: company.id, creatorId: creatorA.id, startDate: '2026-06-05', endDate: '2026-06-07', reason: 'Consulta médica' });
    await absencesRepo.review(company.id, a.id, 'approved', gestor.id);

    const rows = await reportsRepo.absencesListing(company.id, '2026-06-01', '2026-06-30');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ responsibleName: 'Gestora', status: 'approved' });
  });
});
