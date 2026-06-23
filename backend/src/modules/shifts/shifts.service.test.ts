import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { createCreatorsRepository } from '../creators/creators.repository.js';
import { createNotificationsRepository } from '../notifications/notifications.repository.js';
import { createShiftsService } from './shifts.service.js';

describe('shiftsService — sobreaviso', () => {
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);
  const creatorsRepo = createCreatorsRepository(testDb);
  const notificationsRepo = createNotificationsRepository(testDb);
  const shiftsService = createShiftsService(testDb);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  async function setupTenantWithCreators(count: number) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const company = await companiesRepo.create({ name: 'Acme', slug: `acme-${suffix}` });
    const gestor = await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: `g-${suffix}@acme.com`, passwordHash: 'hash', role: 'gestor' });

    const creators = [];
    for (let i = 0; i < count; i++) {
      const u = await usersRepo.create({ tenantId: company.id, name: `Creator ${i}`, email: `creator${i}-${suffix}@acme.com`, passwordHash: 'hash', role: 'operacional' });
      creators.push(await creatorsRepo.createRow({ tenantId: company.id, userId: u.id, employmentType: 'fixed' }));
    }
    return { company, gestor, creators };
  }

  it('create persiste a lista de sobreaviso e notifica titular + cada sobreaviso', async () => {
    const { company, gestor, creators } = await setupTenantWithCreators(3);

    const shift = await shiftsService.create(company.id, gestor.id, {
      shift_date: '2026-06-21',
      creator_id: creators[0]!.id,
      standby_creator_ids: [creators[1]!.id, creators[2]!.id],
    });

    expect(shift.standbyCreatorIds.sort()).toEqual([creators[1]!.id, creators[2]!.id].sort());
    expect(shift.creatorName).toBe('Creator 0');
    expect(shift.standbyNames.sort()).toEqual(['Creator 1', 'Creator 2']);

    const titularNotifs = await notificationsRepo.list(company.id, creators[0]!.userId, { page: 1, pageSize: 50, offset: 0, limit: 50 });
    expect(titularNotifs.rows.filter((n) => n.type === 'novo_plantao')).toHaveLength(1);
    expect(titularNotifs.rows[0]?.title).toBe('Novo plantão');
    // data formatada ("21 jun"), não crua ("2026-06-21").
    expect(titularNotifs.rows[0]?.description).toBe('21 jun');

    for (const standby of [creators[1]!, creators[2]!]) {
      const notifs = await notificationsRepo.list(company.id, standby.userId, { page: 1, pageSize: 50, offset: 0, limit: 50 });
      expect(notifs.rows.filter((n) => n.type === 'novo_plantao')).toHaveLength(1);
      expect(notifs.rows[0]?.title).toBe('Sobreaviso de plantão');
    }
  });

  it('create com standby_creator_ids de outro tenant falha com INVALID_CREATOR', async () => {
    const { company, gestor } = await setupTenantWithCreators(0);
    const { creators: otherCreators } = await setupTenantWithCreators(1);

    await expect(
      shiftsService.create(company.id, gestor.id, { shift_date: '2026-06-21', standby_creator_ids: [otherCreators[0]!.id] }),
    ).rejects.toMatchObject({ code: 'INVALID_CREATOR' });
  });

  it('update troca o titular e notifica só o novo (não renotifica se não mudou)', async () => {
    const { company, gestor, creators } = await setupTenantWithCreators(2);
    const shift = await shiftsService.create(company.id, gestor.id, { shift_date: '2026-06-21', creator_id: creators[0]!.id });

    await shiftsService.update(company.id, shift.id, { creator_id: creators[0]!.id }); // "troca" pro mesmo — não deve notificar de novo
    let notifs = await notificationsRepo.list(company.id, creators[0]!.userId, { page: 1, pageSize: 50, offset: 0, limit: 50 });
    expect(notifs.rows.filter((n) => n.type === 'novo_plantao')).toHaveLength(1); // só a da criação

    await shiftsService.update(company.id, shift.id, { creator_id: creators[1]!.id });
    notifs = await notificationsRepo.list(company.id, creators[1]!.userId, { page: 1, pageSize: 50, offset: 0, limit: 50 });
    expect(notifs.rows.filter((n) => n.type === 'novo_plantao')).toHaveLength(1);
  });

  it('update adiciona sobreaviso novo e notifica só quem entrou, mantendo quem já estava', async () => {
    const { company, gestor, creators } = await setupTenantWithCreators(3);
    const shift = await shiftsService.create(company.id, gestor.id, { shift_date: '2026-06-21', standby_creator_ids: [creators[0]!.id] });

    const updated = await shiftsService.update(company.id, shift.id, { standby_creator_ids: [creators[0]!.id, creators[1]!.id] });
    expect(updated.standbyCreatorIds.sort()).toEqual([creators[0]!.id, creators[1]!.id].sort());

    // creators[0] não é renotificado (já estava), creators[1] recebe exatamente 1.
    const notifs0 = await notificationsRepo.list(company.id, creators[0]!.userId, { page: 1, pageSize: 50, offset: 0, limit: 50 });
    expect(notifs0.rows.filter((n) => n.type === 'novo_plantao')).toHaveLength(1);
    const notifs1 = await notificationsRepo.list(company.id, creators[1]!.userId, { page: 1, pageSize: 50, offset: 0, limit: 50 });
    expect(notifs1.rows.filter((n) => n.type === 'novo_plantao')).toHaveLength(1);
  });

  it('update sem standby_creator_ids no corpo preserva a lista existente', async () => {
    const { company, gestor, creators } = await setupTenantWithCreators(2);
    const shift = await shiftsService.create(company.id, gestor.id, { shift_date: '2026-06-21', standby_creator_ids: [creators[0]!.id] });

    const updated = await shiftsService.update(company.id, shift.id, { notes: 'Turno alterado' });
    expect(updated.standbyCreatorIds).toEqual([creators[0]!.id]);
  });

  it('update com standby_creator_ids: [] remove todos os sobreavisos', async () => {
    const { company, gestor, creators } = await setupTenantWithCreators(1);
    const shift = await shiftsService.create(company.id, gestor.id, { shift_date: '2026-06-21', standby_creator_ids: [creators[0]!.id] });

    const updated = await shiftsService.update(company.id, shift.id, { standby_creator_ids: [] });
    expect(updated.standbyCreatorIds).toEqual([]);
  });

  it('list devolve standby_creator_ids agregado corretamente pra cada plantão', async () => {
    const { company, gestor, creators } = await setupTenantWithCreators(2);
    await shiftsService.create(company.id, gestor.id, { shift_date: '2026-06-21', standby_creator_ids: [creators[0]!.id] });
    await shiftsService.create(company.id, gestor.id, { shift_date: '2026-06-22', standby_creator_ids: [creators[1]!.id] });

    const { rows } = await shiftsService.list({ tenantId: company.id, userId: gestor.id, role: 'gestor' }, { page: 1, pageSize: 50, offset: 0, limit: 50 });
    const day21 = rows.find((r) => r.shiftDate === '2026-06-21');
    const day22 = rows.find((r) => r.shiftDate === '2026-06-22');
    expect(day21?.standbyCreatorIds).toEqual([creators[0]!.id]);
    expect(day22?.standbyCreatorIds).toEqual([creators[1]!.id]);
  });

  it('remove apaga o plantão e o status_history vinculado', async () => {
    const { company, gestor, creators } = await setupTenantWithCreators(1);
    const shift = await shiftsService.create(company.id, gestor.id, { shift_date: '2026-06-21', creator_id: creators[0]!.id });
    await shiftsService.setStatus(company.id, shift.id, 'completed', gestor.id);

    await shiftsService.remove(company.id, shift.id);

    const { rows } = await shiftsService.list({ tenantId: company.id, userId: gestor.id, role: 'gestor' }, { page: 1, pageSize: 50, offset: 0, limit: 50 });
    expect(rows).toHaveLength(0);
  });

  it('remove de plantão inexistente falha com 404 SHIFT_NOT_FOUND', async () => {
    const { company } = await setupTenantWithCreators(0);
    await expect(shiftsService.remove(company.id, '00000000-0000-0000-0000-000000000000')).rejects.toMatchObject({ code: 'SHIFT_NOT_FOUND' });
  });
});
