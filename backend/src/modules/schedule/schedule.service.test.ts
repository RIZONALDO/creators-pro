import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { createCreatorsRepository } from '../creators/creators.repository.js';
import { createAbsencesRepository } from '../absences/absences.repository.js';
import { createNotificationsRepository } from '../notifications/notifications.repository.js';
import { createHolidaysRepository } from './holidays.repository.js';
import { createScheduleService } from './schedule.service.js';

const FAKE_UUID = '00000000-0000-0000-0000-000000000000';

describe('scheduleService', () => {
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);
  const creatorsRepo = createCreatorsRepository(testDb);
  const holidaysRepo = createHolidaysRepository(testDb);
  const absencesRepo = createAbsencesRepository(testDb);
  const notificationsRepo = createNotificationsRepository(testDb);
  const scheduleService = createScheduleService(testDb);

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
      const user = await usersRepo.create({ tenantId: company.id, name: `Creator ${i}`, email: `creator${i}-${suffix}@acme.com`, passwordHash: 'hash', role: 'operacional' });
      creators.push(await creatorsRepo.createRow({ tenantId: company.id, userId: user.id, employmentType: 'fixed' }));
    }

    return { company, gestor, creators };
  }

  it('listEntries começa vazio — linhas só existem depois de uma atribuição real', async () => {
    const { company, gestor } = await setupTenantWithCreators(0);

    const { entries } = await scheduleService.listEntries(company.id, '2026-06', gestor.id);

    expect(entries).toHaveLength(0);
  });

  it('listEntries recalcula is_holiday mesmo se o feriado foi cadastrado depois da atribuição existir', async () => {
    const { company, gestor, creators } = await setupTenantWithCreators(1);
    await scheduleService.assign(company.id, '2026-06-11', creators[0]!.id, gestor.id); // ainda não é feriado
    await holidaysRepo.createGlobal('2026-06-11', 'Corpus Christi');

    const { entries } = await scheduleService.listEntries(company.id, '2026-06', gestor.id);
    const corpusChristi = entries.find((e) => e.workDate === '2026-06-11');
    expect(corpusChristi?.isHoliday).toBe(true);
  });

  it('assign rejeita sábado/domingo e feriado', async () => {
    const { company, gestor } = await setupTenantWithCreators(0);
    await holidaysRepo.createGlobal('2026-06-11', 'Corpus Christi');

    await expect(scheduleService.assign(company.id, '2026-06-20', FAKE_UUID, gestor.id)).rejects.toMatchObject({ code: 'INVALID_WORK_DATE' }); // sábado
    await expect(scheduleService.assign(company.id, '2026-06-11', FAKE_UUID, gestor.id)).rejects.toMatchObject({ code: 'INVALID_WORK_DATE' }); // feriado
  });

  it('assign com creator de outro tenant falha com INVALID_CREATOR', async () => {
    const { company, gestor } = await setupTenantWithCreators(0);
    const { creators: otherCreators } = await setupTenantWithCreators(1);

    await expect(scheduleService.assign(company.id, '2026-06-22', otherCreators[0]!.id, gestor.id)).rejects.toMatchObject({ code: 'INVALID_CREATOR' });
  });

  it('assign permite mais de 1 creator no mesmo dia', async () => {
    const { company, gestor, creators } = await setupTenantWithCreators(2);

    await scheduleService.assign(company.id, '2026-06-22', creators[0]!.id, gestor.id);
    await scheduleService.assign(company.id, '2026-06-22', creators[1]!.id, gestor.id);

    const { entries } = await scheduleService.listEntries(company.id, '2026-06', gestor.id);
    const day22 = entries.filter((e) => e.workDate === '2026-06-22');
    expect(day22).toHaveLength(2);
    expect(day22.map((e) => e.creatorId).sort()).toEqual([creators[0]!.id, creators[1]!.id].sort());
  });

  it('assign notifica o creator escalado (titular ou substituto) — antes só o coordenador ficava sabendo', async () => {
    const { company, gestor, creators } = await setupTenantWithCreators(1);

    await scheduleService.assign(company.id, '2026-06-22', creators[0]!.id, gestor.id);

    const notifs = await notificationsRepo.list(company.id, creators[0]!.userId, { page: 1, pageSize: 50, offset: 0, limit: 50 });
    expect(notifs.rows.filter((n) => n.type === 'alteracao_escala')).toHaveLength(1);
    expect(notifs.rows[0]?.title).toBe('Você foi escalado(a)');
  });

  it('assign rejeita com 409 ALREADY_ASSIGNED se o mesmo creator já está nesse dia', async () => {
    const { company, gestor, creators } = await setupTenantWithCreators(1);
    await scheduleService.assign(company.id, '2026-06-22', creators[0]!.id, gestor.id);

    await expect(scheduleService.assign(company.id, '2026-06-22', creators[0]!.id, gestor.id)).rejects.toMatchObject({ code: 'ALREADY_ASSIGNED' });
  });

  it('unassign remove só o creator indicado, mantendo os outros do mesmo dia', async () => {
    const { company, gestor, creators } = await setupTenantWithCreators(2);
    await scheduleService.assign(company.id, '2026-06-22', creators[0]!.id, gestor.id);
    await scheduleService.assign(company.id, '2026-06-22', creators[1]!.id, gestor.id);

    await scheduleService.unassign(company.id, '2026-06-22', creators[0]!.id);

    const { entries } = await scheduleService.listEntries(company.id, '2026-06', gestor.id);
    const day22 = entries.filter((e) => e.workDate === '2026-06-22');
    expect(day22).toHaveLength(1);
    expect(day22[0]?.creatorId).toBe(creators[1]!.id);
  });

  it('unassign falha com 404 ASSIGNMENT_NOT_FOUND se o creator não está nesse dia', async () => {
    const { company, creators } = await setupTenantWithCreators(1);
    await expect(scheduleService.unassign(company.id, '2026-06-22', creators[0]!.id)).rejects.toMatchObject({ code: 'ASSIGNMENT_NOT_FOUND' });
  });

  it('autoAssign distribui round-robin e pula feriado/fim de semana', async () => {
    const { company, gestor, creators } = await setupTenantWithCreators(2);
    await holidaysRepo.createGlobal('2026-06-11', 'Corpus Christi');

    const { scaleMonth } = await scheduleService.listEntries(company.id, '2026-06', gestor.id);
    const entries = await scheduleService.autoAssign(company.id, scaleMonth.id);

    const corpusChristi = entries.find((e) => e.workDate === '2026-06-11');
    expect(corpusChristi).toBeUndefined(); // feriado nunca recebe atribuição — nem linha

    expect(entries).toHaveLength(21); // 22 dias úteis - 1 feriado, 1 creator por dia
    expect(entries[0]?.creatorId).toBe(creators[0]!.id);
    expect(entries[1]?.creatorId).toBe(creators[1]!.id);
    expect(entries[2]?.creatorId).toBe(creators[0]!.id); // round-robin volta pro primeiro
  });

  it('autoAssign limpa atribuições manuais anteriores do mesmo mês antes de regenerar', async () => {
    const { company, gestor, creators } = await setupTenantWithCreators(2);
    await scheduleService.assign(company.id, '2026-06-01', creators[0]!.id, gestor.id);
    await scheduleService.assign(company.id, '2026-06-01', creators[1]!.id, gestor.id); // 2 no mesmo dia, manual

    const { scaleMonth } = await scheduleService.listEntries(company.id, '2026-06', gestor.id);
    const entries = await scheduleService.autoAssign(company.id, scaleMonth.id);

    const day1 = entries.filter((e) => e.workDate === '2026-06-01');
    expect(day1).toHaveLength(1); // round-robin recriou do zero, não sobrou o segundo creator manual
  });

  // Fase 4b: bloqueio de escala por ausência aprovada.
  it('assign rejeita com 409 ABSENCE_OVERLAPS_SCHEDULE quando o creator tem ausência aprovada cobrindo a data', async () => {
    const { company, gestor, creators } = await setupTenantWithCreators(1);
    const absence = await absencesRepo.create({ tenantId: company.id, creatorId: creators[0]!.id, startDate: '2026-06-24', endDate: '2026-06-26' });
    await absencesRepo.review(company.id, absence.id, 'approved', gestor.id);

    await expect(scheduleService.assign(company.id, '2026-06-25', creators[0]!.id, gestor.id)).rejects.toMatchObject({ code: 'ABSENCE_OVERLAPS_SCHEDULE' });
  });

  it('assign permite o mesmo creator num dia fora do período da ausência', async () => {
    const { company, gestor, creators } = await setupTenantWithCreators(1);
    const absence = await absencesRepo.create({ tenantId: company.id, creatorId: creators[0]!.id, startDate: '2026-06-24', endDate: '2026-06-26' });
    await absencesRepo.review(company.id, absence.id, 'approved', gestor.id);

    const entry = await scheduleService.assign(company.id, '2026-06-22', creators[0]!.id, gestor.id);
    expect(entry.creatorId).toBe(creators[0]!.id);
  });

  it('assign permite atribuir o creator se a ausência ainda está pending (não aprovada)', async () => {
    const { company, gestor, creators } = await setupTenantWithCreators(1);
    await absencesRepo.create({ tenantId: company.id, creatorId: creators[0]!.id, startDate: '2026-06-24', endDate: '2026-06-26' });

    const entry = await scheduleService.assign(company.id, '2026-06-25', creators[0]!.id, gestor.id);
    expect(entry.creatorId).toBe(creators[0]!.id);
  });

  it('autoAssign pula o creator em ausência aprovada na data e usa o outro disponível', async () => {
    const { company, gestor, creators } = await setupTenantWithCreators(2);
    const absence = await absencesRepo.create({ tenantId: company.id, creatorId: creators[0]!.id, startDate: '2026-06-22', endDate: '2026-06-22' });
    await absencesRepo.review(company.id, absence.id, 'approved', gestor.id);

    const { scaleMonth } = await scheduleService.listEntries(company.id, '2026-06', gestor.id);
    const entries = await scheduleService.autoAssign(company.id, scaleMonth.id);

    const day22 = entries.find((e) => e.workDate === '2026-06-22');
    expect(day22?.creatorId).toBe(creators[1]!.id); // creators[0] está de ausência só nesse dia
  });

  it('autoAssign não cria nenhuma linha no dia se todos os creators estiverem em ausência aprovada', async () => {
    const { company, gestor, creators } = await setupTenantWithCreators(1);
    const absence = await absencesRepo.create({ tenantId: company.id, creatorId: creators[0]!.id, startDate: '2026-06-01', endDate: '2026-06-30' });
    await absencesRepo.review(company.id, absence.id, 'approved', gestor.id);

    const { scaleMonth } = await scheduleService.listEntries(company.id, '2026-06', gestor.id);
    const entries = await scheduleService.autoAssign(company.id, scaleMonth.id);

    expect(entries).toHaveLength(0); // nenhum dia recebe linha — não força ninguém ausente
  });

  it('autoAssign sem creators ativos falha com NO_ACTIVE_CREATORS', async () => {
    const { company } = await setupTenantWithCreators(0);
    const gestor = await usersRepo.create({ tenantId: company.id, name: 'G2', email: 'g2@acme.com', passwordHash: 'hash', role: 'gestor' });
    const { scaleMonth } = await scheduleService.listEntries(company.id, '2026-06', gestor.id);

    await expect(scheduleService.autoAssign(company.id, scaleMonth.id)).rejects.toMatchObject({ code: 'NO_ACTIVE_CREATORS' });
  });

  it('duplicateMonth copia o padrão de atribuição preservando o dia do mês', async () => {
    const { company, gestor, creators } = await setupTenantWithCreators(1);
    const { scaleMonth } = await scheduleService.listEntries(company.id, '2026-06', gestor.id);
    await scheduleService.assign(company.id, '2026-06-02', creators[0]!.id, gestor.id); // terça

    const { entries } = await scheduleService.duplicateMonth(company.id, scaleMonth.id, 7, 2026, gestor.id);

    const duplicated = entries.find((e) => e.workDate === '2026-07-02'); // mesma posição de dia, também é dia útil em julho/2026
    expect(duplicated?.creatorId).toBe(creators[0]!.id);
  });

  it('duplicateMonth copia todos os creators de um dia com mais de 1 atribuição', async () => {
    const { company, gestor, creators } = await setupTenantWithCreators(2);
    const { scaleMonth } = await scheduleService.listEntries(company.id, '2026-06', gestor.id);
    await scheduleService.assign(company.id, '2026-06-02', creators[0]!.id, gestor.id);
    await scheduleService.assign(company.id, '2026-06-02', creators[1]!.id, gestor.id);

    const { entries } = await scheduleService.duplicateMonth(company.id, scaleMonth.id, 7, 2026, gestor.id);

    const duplicated = entries.filter((e) => e.workDate === '2026-07-02');
    expect(duplicated).toHaveLength(2);
  });

  it('duplicateMonth não copia a atribuição se o creator tiver ausência aprovada na data de destino', async () => {
    const { company, gestor, creators } = await setupTenantWithCreators(1);
    const { scaleMonth } = await scheduleService.listEntries(company.id, '2026-06', gestor.id);
    await scheduleService.assign(company.id, '2026-06-02', creators[0]!.id, gestor.id);

    const absence = await absencesRepo.create({ tenantId: company.id, creatorId: creators[0]!.id, startDate: '2026-07-02', endDate: '2026-07-02' });
    await absencesRepo.review(company.id, absence.id, 'approved', gestor.id);

    const { entries } = await scheduleService.duplicateMonth(company.id, scaleMonth.id, 7, 2026, gestor.id);

    const duplicated = entries.find((e) => e.workDate === '2026-07-02');
    expect(duplicated).toBeUndefined(); // só esse creator é pulado, não sobra linha nenhuma nesse dia
  });

  it('duplicateMonth limpa atribuições anteriores do mês de destino antes de regenerar', async () => {
    const { company, gestor, creators } = await setupTenantWithCreators(1);
    const { scaleMonth } = await scheduleService.listEntries(company.id, '2026-06', gestor.id);
    await scheduleService.assign(company.id, '2026-06-02', creators[0]!.id, gestor.id);

    await scheduleService.assign(company.id, '2026-07-03', creators[0]!.id, gestor.id); // atribuição manual já existente em julho, dia diferente do que será duplicado

    const { entries } = await scheduleService.duplicateMonth(company.id, scaleMonth.id, 7, 2026, gestor.id);

    expect(entries.find((e) => e.workDate === '2026-07-03')).toBeUndefined(); // limpo antes de regenerar
  });

  it('GET /holidays via service lista globais + do tenant', async () => {
    const { company } = await setupTenantWithCreators(0);
    await holidaysRepo.createGlobal('2026-06-11', 'Corpus Christi');

    const list = await scheduleService.holidays.list(company.id, '2026-06');
    expect(list).toHaveLength(1);
  });
});
