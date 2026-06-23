import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { createCreatorsRepository } from '../creators/creators.repository.js';
import { createNotificationsRepository } from '../notifications/notifications.repository.js';
import { createScaleEntriesRepository } from '../schedule/scaleEntries.repository.js';
import { createScaleMonthsRepository } from '../schedule/scaleMonths.repository.js';
import { createStatusHistoryRepository } from '../statusHistory/statusHistory.repository.js';
import { createAbsencesService } from './absences.service.js';

describe('absencesService', () => {
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);
  const creatorsRepo = createCreatorsRepository(testDb);
  const statusHistoryRepo = createStatusHistoryRepository(testDb);
  const notificationsRepo = createNotificationsRepository(testDb);
  const scaleMonthsRepo = createScaleMonthsRepository(testDb);
  const scaleEntriesRepo = createScaleEntriesRepository(testDb);
  const absencesService = createAbsencesService(testDb);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  async function setupTenant() {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const gestor = await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: 'g@acme.com', passwordHash: 'hash', role: 'gestor' });
    const creatorUser = await usersRepo.create({ tenantId: company.id, name: 'Creator', email: 'creator@acme.com', passwordHash: 'hash', role: 'operacional' });
    const creator = await creatorsRepo.createRow({ tenantId: company.id, userId: creatorUser.id, employmentType: 'fixed' });
    return { company, gestor, creator, creatorUser };
  }

  it('operacional só pode solicitar para o próprio creator vinculado', async () => {
    const { company, creator, creatorUser } = await setupTenant();
    const otherUser = await usersRepo.create({ tenantId: company.id, name: 'Outro', email: 'outro@acme.com', passwordHash: 'hash', role: 'operacional' });
    await creatorsRepo.createRow({ tenantId: company.id, userId: otherUser.id, employmentType: 'freelancer' });

    const ownAuth = { userId: creatorUser.id, tenantId: company.id, role: 'operacional' as const };
    const otherAuth = { userId: otherUser.id, tenantId: company.id, role: 'operacional' as const };

    const created = await absencesService.create(ownAuth, { creator_id: creator.id, start_date: '2026-06-24', end_date: '2026-06-26' });
    expect(created.creatorId).toBe(creator.id);

    // otherUser tem creator próprio (otherCreator), mas tenta solicitar em nome do creator de ownAuth.
    await expect(
      absencesService.create(otherAuth, { creator_id: creator.id, start_date: '2026-06-24', end_date: '2026-06-26' }),
    ).rejects.toMatchObject({ code: 'CANNOT_REQUEST_FOR_OTHER_CREATOR' });
  });

  it('operacional sem creator vinculado nenhum falha com NO_CREATOR_LINKED', async () => {
    const { company } = await setupTenant();
    const userWithoutCreator = await usersRepo.create({ tenantId: company.id, name: 'Sem creator', email: 'sem-creator@acme.com', passwordHash: 'hash', role: 'operacional' });
    const auth = { userId: userWithoutCreator.id, tenantId: company.id, role: 'operacional' as const };

    await expect(
      absencesService.create(auth, { start_date: '2026-06-24', end_date: '2026-06-26' }),
    ).rejects.toMatchObject({ code: 'NO_CREATOR_LINKED' });
  });

  it('operacional pode omitir creator_id — resolve pro próprio automaticamente', async () => {
    const { creator, creatorUser } = await setupTenant();
    const ownAuth = { userId: creatorUser.id, tenantId: creator.tenantId, role: 'operacional' as const };

    const created = await absencesService.create(ownAuth, { start_date: '2026-06-24', end_date: '2026-06-26' });
    expect(created.creatorId).toBe(creator.id);
  });

  it('admin/gestor não pode omitir creator_id', async () => {
    const { company, gestor } = await setupTenant();
    const gestorAuth = { userId: gestor.id, tenantId: company.id, role: 'gestor' as const };

    await expect(
      absencesService.create(gestorAuth, { start_date: '2026-06-24', end_date: '2026-06-26' }),
    ).rejects.toMatchObject({ code: 'CREATOR_ID_REQUIRED' });
  });

  it('gestor pode registrar ausência em nome de qualquer creator do tenant', async () => {
    const { company, gestor, creator } = await setupTenant();
    const gestorAuth = { userId: gestor.id, tenantId: company.id, role: 'gestor' as const };

    const created = await absencesService.create(gestorAuth, { creator_id: creator.id, start_date: '2026-06-24', end_date: '2026-06-26' });
    expect(created.creatorId).toBe(creator.id);
  });

  it('end_date antes de start_date falha com INVALID_DATE_RANGE', async () => {
    const { company, gestor, creator } = await setupTenant();
    const gestorAuth = { userId: gestor.id, tenantId: company.id, role: 'gestor' as const };

    await expect(
      absencesService.create(gestorAuth, { creator_id: creator.id, start_date: '2026-06-26', end_date: '2026-06-24' }),
    ).rejects.toMatchObject({ code: 'INVALID_DATE_RANGE' });
  });

  it('review grava exatamente 1 linha em status_history', async () => {
    const { company, gestor, creator } = await setupTenant();
    const gestorAuth = { userId: gestor.id, tenantId: company.id, role: 'gestor' as const };
    const created = await absencesService.create(gestorAuth, { creator_id: creator.id, start_date: '2026-06-24', end_date: '2026-06-26' });

    await absencesService.review(company.id, created.id, 'approved', gestor.id);

    const history = await statusHistoryRepo.list(company.id, 'absence', created.id);
    expect(history).toHaveLength(1);
    expect(history[0]?.oldStatus).toBe('pending');
    expect(history[0]?.newStatus).toBe('approved');
  });

  it('operacional sem creator vinculado vê lista vazia', async () => {
    const { company } = await setupTenant();
    const opUser = await usersRepo.create({ tenantId: company.id, name: 'Op', email: 'op@acme.com', passwordHash: 'hash', role: 'operacional' });

    const { rows, total } = await absencesService.list({ userId: opUser.id, tenantId: company.id, role: 'operacional' }, { page: 1, pageSize: 50, offset: 0, limit: 50 });
    expect(total).toBe(0);
    expect(rows).toHaveLength(0);
  });

  it('review aprovada grava notification ausencia_aprovada pro creator', async () => {
    const { company, gestor, creator, creatorUser } = await setupTenant();
    const created = await absencesService.create({ userId: gestor.id, tenantId: company.id, role: 'gestor' }, { creator_id: creator.id, start_date: '2026-06-24', end_date: '2026-06-26' });

    await absencesService.review(company.id, created.id, 'approved', gestor.id);

    const { rows } = await notificationsRepo.list(company.id, creatorUser.id, { page: 1, pageSize: 50, offset: 0, limit: 50 });
    expect(rows.filter((n) => n.type === 'ausencia_aprovada')).toHaveLength(1);
    // datas formatadas ("24 jun"), não cruas ("2026-06-24") — mesmo padrão de exibição do frontend.
    expect(rows.find((n) => n.type === 'ausencia_aprovada')?.description).toBe('24 jun – 26 jun');
  });

  it('review rejeitada grava notification ausencia_rejeitada pro creator', async () => {
    const { company, gestor, creator, creatorUser } = await setupTenant();
    const created = await absencesService.create({ userId: gestor.id, tenantId: company.id, role: 'gestor' }, { creator_id: creator.id, start_date: '2026-06-24', end_date: '2026-06-26' });

    await absencesService.review(company.id, created.id, 'rejected', gestor.id);

    const { rows } = await notificationsRepo.list(company.id, creatorUser.id, { page: 1, pageSize: 50, offset: 0, limit: 50 });
    expect(rows.filter((n) => n.type === 'ausencia_rejeitada')).toHaveLength(1);
  });

  it('aprovar ausência que sobrepõe escala já atribuída notifica coordenadores com alteracao_escala', async () => {
    const { company, gestor, creator, creatorUser } = await setupTenant();
    const admin = await usersRepo.create({ tenantId: company.id, name: 'Admin', email: 'admin@acme.com', passwordHash: 'hash', role: 'admin' });

    const scaleMonth = await scaleMonthsRepo.create({ tenantId: company.id, month: 6, year: 2026, createdBy: gestor.id });
    await scaleEntriesRepo.createMany([{ tenantId: company.id, scaleMonthId: scaleMonth.id, workDate: '2026-06-25', creatorId: creator.id, isHoliday: false }]);

    const created = await absencesService.create({ userId: gestor.id, tenantId: company.id, role: 'gestor' }, { creator_id: creator.id, start_date: '2026-06-24', end_date: '2026-06-26' });
    await absencesService.review(company.id, created.id, 'approved', gestor.id);

    const gestorNotifications = await notificationsRepo.list(company.id, gestor.id, { page: 1, pageSize: 50, offset: 0, limit: 50 });
    const adminNotifications = await notificationsRepo.list(company.id, admin.id, { page: 1, pageSize: 50, offset: 0, limit: 50 });
    const creatorNotifications = await notificationsRepo.list(company.id, creatorUser.id, { page: 1, pageSize: 50, offset: 0, limit: 50 });

    expect(gestorNotifications.rows.filter((n) => n.type === 'alteracao_escala')).toHaveLength(1);
    expect(adminNotifications.rows.filter((n) => n.type === 'alteracao_escala')).toHaveLength(1);
    // o creator recebe a notificação de aprovação, mas não a de conflito de escala (essa é só pros coordenadores).
    expect(creatorNotifications.rows.filter((n) => n.type === 'alteracao_escala')).toHaveLength(0);
  });
});
