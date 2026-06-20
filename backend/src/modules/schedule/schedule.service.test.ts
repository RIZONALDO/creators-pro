import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { createCreatorsRepository } from '../creators/creators.repository.js';
import { createAbsencesRepository } from '../absences/absences.repository.js';
import { createHolidaysRepository } from './holidays.repository.js';
import { createScheduleService } from './schedule.service.js';

describe('scheduleService', () => {
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);
  const creatorsRepo = createCreatorsRepository(testDb);
  const holidaysRepo = createHolidaysRepository(testDb);
  const absencesRepo = createAbsencesRepository(testDb);
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

  it('listEntries cria 1 linha por dia útil do mês (22 dias em junho/2026)', async () => {
    const { company, gestor } = await setupTenantWithCreators(0);

    const { entries } = await scheduleService.listEntries(company.id, '2026-06', gestor.id);

    expect(entries).toHaveLength(22);
    expect(entries.every((e) => e.creatorId === null)).toBe(true);
  });

  it('listEntries marca is_holiday mesmo se o feriado foi cadastrado depois das linhas existirem', async () => {
    const { company, gestor } = await setupTenantWithCreators(0);
    await scheduleService.listEntries(company.id, '2026-06', gestor.id); // cria as linhas sem feriado nenhum
    await holidaysRepo.createGlobal('2026-06-11', 'Corpus Christi');

    const { entries } = await scheduleService.listEntries(company.id, '2026-06', gestor.id);
    const corpusChristi = entries.find((e) => e.workDate === '2026-06-11');
    expect(corpusChristi?.isHoliday).toBe(true);
  });

  it('assign rejeita sábado/domingo e feriado', async () => {
    const { company, gestor } = await setupTenantWithCreators(0);
    await holidaysRepo.createGlobal('2026-06-11', 'Corpus Christi');

    await expect(scheduleService.assign(company.id, '2026-06-20', null, gestor.id)).rejects.toMatchObject({ code: 'INVALID_WORK_DATE' }); // sábado
    await expect(scheduleService.assign(company.id, '2026-06-11', null, gestor.id)).rejects.toMatchObject({ code: 'INVALID_WORK_DATE' }); // feriado
  });

  it('assign com creator de outro tenant falha com INVALID_CREATOR', async () => {
    const { company, gestor } = await setupTenantWithCreators(0);
    const { creators: otherCreators } = await setupTenantWithCreators(1);

    await expect(scheduleService.assign(company.id, '2026-06-22', otherCreators[0]!.id, gestor.id)).rejects.toMatchObject({ code: 'INVALID_CREATOR' });
  });

  it('autoAssign distribui round-robin e pula feriado/fim de semana', async () => {
    const { company, gestor, creators } = await setupTenantWithCreators(2);
    await holidaysRepo.createGlobal('2026-06-11', 'Corpus Christi');

    const { scaleMonth } = await scheduleService.listEntries(company.id, '2026-06', gestor.id);
    const entries = await scheduleService.autoAssign(company.id, scaleMonth.id);

    const corpusChristi = entries.find((e) => e.workDate === '2026-06-11');
    expect(corpusChristi?.creatorId).toBeNull(); // feriado nunca recebe atribuição

    const assigned = entries.filter((e) => e.creatorId !== null);
    expect(assigned).toHaveLength(21); // 22 dias úteis - 1 feriado
    expect(assigned[0]?.creatorId).toBe(creators[0]!.id);
    expect(assigned[1]?.creatorId).toBe(creators[1]!.id);
    expect(assigned[2]?.creatorId).toBe(creators[0]!.id); // round-robin volta pro primeiro
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

  it('autoAssign deixa o dia sem ninguém se todos os creators estiverem em ausência aprovada', async () => {
    const { company, gestor, creators } = await setupTenantWithCreators(1);
    const absence = await absencesRepo.create({ tenantId: company.id, creatorId: creators[0]!.id, startDate: '2026-06-01', endDate: '2026-06-30' });
    await absencesRepo.review(company.id, absence.id, 'approved', gestor.id);

    const { scaleMonth } = await scheduleService.listEntries(company.id, '2026-06', gestor.id);
    const entries = await scheduleService.autoAssign(company.id, scaleMonth.id);

    expect(entries.every((e) => e.creatorId === null)).toBe(true);
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

  it('duplicateMonth não copia a atribuição se o creator tiver ausência aprovada na data de destino', async () => {
    const { company, gestor, creators } = await setupTenantWithCreators(1);
    const { scaleMonth } = await scheduleService.listEntries(company.id, '2026-06', gestor.id);
    await scheduleService.assign(company.id, '2026-06-02', creators[0]!.id, gestor.id);

    const absence = await absencesRepo.create({ tenantId: company.id, creatorId: creators[0]!.id, startDate: '2026-07-02', endDate: '2026-07-02' });
    await absencesRepo.review(company.id, absence.id, 'approved', gestor.id);

    const { entries } = await scheduleService.duplicateMonth(company.id, scaleMonth.id, 7, 2026, gestor.id);

    const duplicated = entries.find((e) => e.workDate === '2026-07-02');
    expect(duplicated?.creatorId).toBeNull();
  });

  it('GET /holidays via service lista globais + do tenant', async () => {
    const { company } = await setupTenantWithCreators(0);
    await holidaysRepo.createGlobal('2026-06-11', 'Corpus Christi');

    const list = await scheduleService.holidays.list(company.id, '2026-06');
    expect(list).toHaveLength(1);
  });
});
