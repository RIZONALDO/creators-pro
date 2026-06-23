import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { createCreatorsRepository } from '../creators/creators.repository.js';
import { createAbsencesRepository } from '../absences/absences.repository.js';
import { createNotificationsRepository } from '../notifications/notifications.repository.js';
import { createStatusHistoryRepository } from '../statusHistory/statusHistory.repository.js';
import { createTasksRepository } from './tasks.repository.js';
import { createTasksService } from './tasks.service.js';

function daysFromToday(offset: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

describe('tasksService', () => {
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);
  const creatorsRepo = createCreatorsRepository(testDb);
  const absencesRepo = createAbsencesRepository(testDb);
  const statusHistoryRepo = createStatusHistoryRepository(testDb);
  const notificationsRepo = createNotificationsRepository(testDb);
  const tasksRepo = createTasksRepository(testDb);
  const tasksService = createTasksService(testDb);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  async function setupTenant() {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const gestor = await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: 'g@acme.com', passwordHash: 'hash', role: 'gestor' });
    return { company, gestor };
  }

  it('setStatus grava exatamente 1 linha em status_history com old/new corretos', async () => {
    const { company, gestor } = await setupTenant();
    const task = await tasksService.create(company.id, gestor.id, { title: 'Reels' });

    await tasksService.setStatus(company.id, task.id, 'em_edicao', gestor.id);

    const history = await statusHistoryRepo.list(company.id, 'task', task.id);
    expect(history).toHaveLength(1);
    expect(history[0]?.oldStatus).toBe('na_fila');
    expect(history[0]?.newStatus).toBe('em_edicao');
    expect(history[0]?.changedBy).toBe(gestor.id);
  });

  it('duas mudanças de status seguidas geram 2 linhas encadeadas', async () => {
    const { company, gestor } = await setupTenant();
    const task = await tasksService.create(company.id, gestor.id, { title: 'Reels' });

    await tasksService.setStatus(company.id, task.id, 'em_edicao', gestor.id);
    await tasksService.setStatus(company.id, task.id, 'aprovado', gestor.id);

    const history = await statusHistoryRepo.list(company.id, 'task', task.id);
    expect(history).toHaveLength(2);
    expect(history[1]?.oldStatus).toBe('em_edicao');
    expect(history[1]?.newStatus).toBe('aprovado');
  });

  it('create com creator_id de outro tenant falha com INVALID_CREATOR', async () => {
    const { company, gestor } = await setupTenant();
    const otherCompany = await companiesRepo.create({ name: 'Other', slug: 'other' });
    const otherUser = await usersRepo.create({ tenantId: otherCompany.id, name: 'U', email: 'u@other.com', passwordHash: 'hash', role: 'operacional' });
    const otherCreator = await creatorsRepo.createRow({ tenantId: otherCompany.id, userId: otherUser.id, employmentType: 'fixed' });

    await expect(tasksService.create(company.id, gestor.id, { title: 'X', creator_id: otherCreator.id })).rejects.toMatchObject({
      code: 'INVALID_CREATOR',
    });
  });

  it('operacional sem creator vinculado vê lista vazia', async () => {
    const { company } = await setupTenant();
    const opUser = await usersRepo.create({ tenantId: company.id, name: 'Op', email: 'op@acme.com', passwordHash: 'hash', role: 'operacional' });

    const { rows, total } = await tasksService.list({ userId: opUser.id, tenantId: company.id, role: 'operacional' }, { page: 1, pageSize: 50, offset: 0, limit: 50 });
    expect(total).toBe(0);
    expect(rows).toHaveLength(0);
  });

  it('create com creator_id grava notification nova_tarefa pro creator (gatilho specs/06)', async () => {
    const { company, gestor } = await setupTenant();
    const creatorUser = await usersRepo.create({ tenantId: company.id, name: 'Creator', email: 'creator@acme.com', passwordHash: 'hash', role: 'operacional' });
    const creator = await creatorsRepo.createRow({ tenantId: company.id, userId: creatorUser.id, employmentType: 'fixed' });

    await tasksService.create(company.id, gestor.id, { title: 'Reels', creator_id: creator.id });

    const { rows } = await notificationsRepo.list(company.id, creatorUser.id, { page: 1, pageSize: 50, offset: 0, limit: 50 });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.type).toBe('nova_tarefa');
  });

  it('setStatus grava notification mudanca_status pro creator e pro created_by', async () => {
    const { company, gestor } = await setupTenant();
    const creatorUser = await usersRepo.create({ tenantId: company.id, name: 'Creator', email: 'creator2@acme.com', passwordHash: 'hash', role: 'operacional' });
    const creator = await creatorsRepo.createRow({ tenantId: company.id, userId: creatorUser.id, employmentType: 'fixed' });
    const task = await tasksService.create(company.id, gestor.id, { title: 'Reels', creator_id: creator.id });

    await tasksService.setStatus(company.id, task.id, 'em_edicao', gestor.id);

    const creatorNotifications = await notificationsRepo.list(company.id, creatorUser.id, { page: 1, pageSize: 50, offset: 0, limit: 50 });
    const gestorNotifications = await notificationsRepo.list(company.id, gestor.id, { page: 1, pageSize: 50, offset: 0, limit: 50 });
    expect(creatorNotifications.rows.filter((n) => n.type === 'mudanca_status')).toHaveLength(1);
    expect(gestorNotifications.rows.filter((n) => n.type === 'mudanca_status')).toHaveLength(1);
    // texto precisa dizer qual status (não só o título da tarefa) — sem isso ninguém sabia pra
    // onde a tarefa tinha mudado sem abrir o app.
    expect(creatorNotifications.rows.find((n) => n.type === 'mudanca_status')?.description).toBe('Reels agora está em "Em edição"');
  });

  // limit-min-date: não permite tarefa retroativa.
  it('create rejeita task_date no passado com 400 TASK_DATE_IN_PAST', async () => {
    const { company, gestor } = await setupTenant();
    await expect(tasksService.create(company.id, gestor.id, { title: 'Reels', task_date: daysFromToday(-1) })).rejects.toMatchObject({ code: 'TASK_DATE_IN_PAST' });
  });

  it('create aceita task_date de hoje (limite, não é retroativo)', async () => {
    const { company, gestor } = await setupTenant();
    const task = await tasksService.create(company.id, gestor.id, { title: 'Reels', task_date: daysFromToday(0) });
    expect(task.taskDate).toBe(daysFromToday(0));
  });

  it('update rejeita mudar task_date pro passado com 400 TASK_DATE_IN_PAST', async () => {
    const { company, gestor } = await setupTenant();
    const task = await tasksService.create(company.id, gestor.id, { title: 'Reels', task_date: daysFromToday(0) });
    await expect(tasksService.update(company.id, task.id, { task_date: daysFromToday(-2) })).rejects.toMatchObject({ code: 'TASK_DATE_IN_PAST' });
  });

  it('update não revalida task_date antiga quando ela não é alterada (tarefa histórica)', async () => {
    const { company, gestor } = await setupTenant();
    // bypassa o service (que bloquearia na criação) pra simular uma tarefa antiga já existente.
    const task = await tasksRepo.create({ tenantId: company.id, title: 'Histórica', taskDate: daysFromToday(-30), status: 'aprovado', createdBy: gestor.id });

    const updated = await tasksService.update(company.id, task.id, { title: 'Histórica (editada)' });
    expect(updated.title).toBe('Histórica (editada)');
    expect(updated.taskDate).toBe(daysFromToday(-30));
  });

  // Ausência aprovada bloqueia tarefa nessa data (mesma regra da escala).
  it('create rejeita com 409 ABSENCE_OVERLAPS_TASK quando o creator tem ausência aprovada cobrindo a data', async () => {
    const { company, gestor } = await setupTenant();
    const creatorUser = await usersRepo.create({ tenantId: company.id, name: 'Creator', email: 'creator-abs@acme.com', passwordHash: 'hash', role: 'operacional' });
    const creator = await creatorsRepo.createRow({ tenantId: company.id, userId: creatorUser.id, employmentType: 'fixed' });
    const absence = await absencesRepo.create({ tenantId: company.id, creatorId: creator.id, startDate: daysFromToday(1), endDate: daysFromToday(3) });
    await absencesRepo.review(company.id, absence.id, 'approved', gestor.id);

    await expect(
      tasksService.create(company.id, gestor.id, { title: 'Reels', creator_id: creator.id, task_date: daysFromToday(2) }),
    ).rejects.toMatchObject({ code: 'ABSENCE_OVERLAPS_TASK' });
  });

  it('create permite a tarefa se a ausência ainda está pending (não aprovada)', async () => {
    const { company, gestor } = await setupTenant();
    const creatorUser = await usersRepo.create({ tenantId: company.id, name: 'Creator', email: 'creator-pend@acme.com', passwordHash: 'hash', role: 'operacional' });
    const creator = await creatorsRepo.createRow({ tenantId: company.id, userId: creatorUser.id, employmentType: 'fixed' });
    await absencesRepo.create({ tenantId: company.id, creatorId: creator.id, startDate: daysFromToday(1), endDate: daysFromToday(3) });

    const task = await tasksService.create(company.id, gestor.id, { title: 'Reels', creator_id: creator.id, task_date: daysFromToday(2) });
    expect(task.creatorId).toBe(creator.id);
  });

  it('update rejeita trocar a data pra dentro do período de ausência do creator já atribuído', async () => {
    const { company, gestor } = await setupTenant();
    const creatorUser = await usersRepo.create({ tenantId: company.id, name: 'Creator', email: 'creator-upd1@acme.com', passwordHash: 'hash', role: 'operacional' });
    const creator = await creatorsRepo.createRow({ tenantId: company.id, userId: creatorUser.id, employmentType: 'fixed' });
    const task = await tasksService.create(company.id, gestor.id, { title: 'Reels', creator_id: creator.id, task_date: daysFromToday(0) });
    const absence = await absencesRepo.create({ tenantId: company.id, creatorId: creator.id, startDate: daysFromToday(5), endDate: daysFromToday(7) });
    await absencesRepo.review(company.id, absence.id, 'approved', gestor.id);

    await expect(tasksService.update(company.id, task.id, { task_date: daysFromToday(6) })).rejects.toMatchObject({ code: 'ABSENCE_OVERLAPS_TASK' });
  });

  it('update rejeita trocar o creator pra um que tem ausência aprovada cobrindo a data já existente da tarefa', async () => {
    const { company, gestor } = await setupTenant();
    const creatorUserA = await usersRepo.create({ tenantId: company.id, name: 'A', email: 'creator-upd-a@acme.com', passwordHash: 'hash', role: 'operacional' });
    const creatorA = await creatorsRepo.createRow({ tenantId: company.id, userId: creatorUserA.id, employmentType: 'fixed' });
    const creatorUserB = await usersRepo.create({ tenantId: company.id, name: 'B', email: 'creator-upd-b@acme.com', passwordHash: 'hash', role: 'operacional' });
    const creatorB = await creatorsRepo.createRow({ tenantId: company.id, userId: creatorUserB.id, employmentType: 'fixed' });

    const task = await tasksService.create(company.id, gestor.id, { title: 'Reels', creator_id: creatorA.id, task_date: daysFromToday(2) });
    const absence = await absencesRepo.create({ tenantId: company.id, creatorId: creatorB.id, startDate: daysFromToday(1), endDate: daysFromToday(3) });
    await absencesRepo.review(company.id, absence.id, 'approved', gestor.id);

    await expect(tasksService.update(company.id, task.id, { creator_id: creatorB.id })).rejects.toMatchObject({ code: 'ABSENCE_OVERLAPS_TASK' });
  });

  it('update permite editar outro campo sem revalidar ausência se nem creator nem data forem alterados', async () => {
    const { company, gestor } = await setupTenant();
    const creatorUser = await usersRepo.create({ tenantId: company.id, name: 'Creator', email: 'creator-upd2@acme.com', passwordHash: 'hash', role: 'operacional' });
    const creator = await creatorsRepo.createRow({ tenantId: company.id, userId: creatorUser.id, employmentType: 'fixed' });
    const task = await tasksService.create(company.id, gestor.id, { title: 'Reels', creator_id: creator.id, task_date: daysFromToday(2) });
    // ausência aprovada cobrindo a MESMA data, criada DEPOIS da tarefa já existir (mesmo cenário do conflito de escala) — update de outro campo não deve travar.
    const absence = await absencesRepo.create({ tenantId: company.id, creatorId: creator.id, startDate: daysFromToday(1), endDate: daysFromToday(3) });
    await absencesRepo.review(company.id, absence.id, 'approved', gestor.id);

    const updated = await tasksService.update(company.id, task.id, { title: 'Reels (revisado)' });
    expect(updated.title).toBe('Reels (revisado)');
  });
});
