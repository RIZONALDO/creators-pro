import type { db as Db } from '../../db/client.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { createAbsencesRepository } from '../absences/absences.repository.js';
import { createCreatorsRepository } from '../creators/creators.repository.js';
import { createHolidaysRepository } from './holidays.repository.js';
import { createScaleEntriesRepository } from './scaleEntries.repository.js';
import { createScaleMonthsRepository } from './scaleMonths.repository.js';
import {
  buildDateStr,
  dayOfMonth,
  getWeekdaysInMonth,
  isValidDayInMonth,
  isValidWorkDateFormat,
  isWeekday,
  parseMonthParam,
} from './schedule.dates.js';

export function createScheduleService(db: typeof Db) {
  const scaleMonthsRepo = createScaleMonthsRepository(db);
  const scaleEntriesRepo = createScaleEntriesRepository(db);
  const holidaysRepo = createHolidaysRepository(db);
  const creatorsRepo = createCreatorsRepository(db);
  const absencesRepo = createAbsencesRepository(db);

  async function getOrCreateScaleMonth(tenantId: string, month: number, year: number, createdBy: string) {
    const existing = await scaleMonthsRepo.findByMonth(tenantId, month, year);
    if (existing) return existing;
    return scaleMonthsRepo.create({ tenantId, month, year, createdBy });
  }

  async function holidaySetForMonth(tenantId: string, year: number, month: number): Promise<Set<string>> {
    const rows = await holidaysRepo.listForMonth(tenantId, year, month);
    return new Set(rows.map((r) => r.holidayDate));
  }

  /** Garante 1 linha por dia útil do mês (cria as que faltarem) e devolve a visão fresca, com is_holiday sempre recalculado. */
  async function listEntries(tenantId: string, monthParam: unknown, createdBy: string) {
    const { year, month } = parseMonthParam(monthParam);
    const scaleMonth = await getOrCreateScaleMonth(tenantId, month, year, createdBy);
    const holidaySet = await holidaySetForMonth(tenantId, year, month);
    const weekdays = getWeekdaysInMonth(year, month);

    const existing = await scaleEntriesRepo.listByMonth(tenantId, scaleMonth.id);
    const existingDates = new Set(existing.map((e) => e.workDate));
    const missing = weekdays.filter((d) => !existingDates.has(d));

    if (missing.length > 0) {
      await scaleEntriesRepo.createMany(
        missing.map((workDate) => ({ tenantId, scaleMonthId: scaleMonth.id, workDate, isHoliday: holidaySet.has(workDate) })),
      );
    }

    const all = missing.length > 0 ? await scaleEntriesRepo.listByMonth(tenantId, scaleMonth.id) : existing;
    const entries = all.map((e) => ({ ...e, isHoliday: holidaySet.has(e.workDate) }));

    return { scaleMonth, entries };
  }

  async function assign(tenantId: string, workDate: unknown, creatorId: string | null, createdBy: string) {
    if (!isValidWorkDateFormat(workDate)) throw badRequest('INVALID_WORK_DATE', 'work_date deve estar no formato YYYY-MM-DD.');
    if (!isWeekday(workDate)) throw badRequest('INVALID_WORK_DATE', 'Não é possível escalar em fim de semana.');

    const [yearStr, monthStr] = workDate.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);

    const holidaySet = await holidaySetForMonth(tenantId, year, month);
    if (holidaySet.has(workDate)) throw badRequest('INVALID_WORK_DATE', 'Não é possível escalar em feriado.');

    if (creatorId) {
      const creator = await creatorsRepo.findRowById(tenantId, creatorId);
      if (!creator) throw badRequest('INVALID_CREATOR', 'Creator inválido para este tenant.');

      const overlapping = await absencesRepo.findApprovedOverlapping(tenantId, creatorId, workDate);
      if (overlapping) throw conflict('ABSENCE_OVERLAPS_SCHEDULE', 'Creator já possui ausência aprovada nesse período.');
    }

    const scaleMonth = await getOrCreateScaleMonth(tenantId, month, year, createdBy);
    return scaleEntriesRepo.upsertAssignment({ tenantId, scaleMonthId: scaleMonth.id, workDate, creatorId, isHoliday: false });
  }

  /**
   * Round-robin pulando feriados/fins de semana e creators com ausência aprovada cobrindo o dia
   * (Fase 4b). Se todos os creators estiverem indisponíveis num dia, ele fica sem atribuição
   * (creator_id null) — não removemos a tentativa, só não force-atribuímos alguém ausente.
   *
   * TODO (Fase 6): emitir notification 'alteracao_escala' pro(s) coordenador(es) quando uma
   * ausência aprovada depois de já escalado gera conflito — ver specs/06-regras-de-negocio.md.
   * Não implementado aqui porque a tabela `notifications` só existe a partir da Fase 6.
   */
  async function autoAssign(tenantId: string, scaleMonthId: string) {
    const scaleMonth = await scaleMonthsRepo.findById(tenantId, scaleMonthId);
    if (!scaleMonth) throw notFound('SCALE_MONTH_NOT_FOUND', 'Mês de escala não encontrado.');

    const creatorIds = await creatorsRepo.listActiveIds(tenantId);
    if (creatorIds.length === 0) throw badRequest('NO_ACTIVE_CREATORS', 'Nenhum creator ativo para distribuir a escala.');

    const holidaySet = await holidaySetForMonth(tenantId, scaleMonth.year, scaleMonth.month);
    const workableDays = getWeekdaysInMonth(scaleMonth.year, scaleMonth.month).filter((d) => !holidaySet.has(d));

    let pointer = 0;
    for (const workDate of workableDays) {
      let chosenCreatorId: string | null = null;

      for (let attempt = 0; attempt < creatorIds.length; attempt++) {
        const candidate = creatorIds[(pointer + attempt) % creatorIds.length]!;
        const overlapping = await absencesRepo.findApprovedOverlapping(tenantId, candidate, workDate);
        if (!overlapping) {
          chosenCreatorId = candidate;
          pointer = (pointer + attempt + 1) % creatorIds.length;
          break;
        }
      }

      await scaleEntriesRepo.upsertAssignment({ tenantId, scaleMonthId: scaleMonth.id, workDate, creatorId: chosenCreatorId, isHoliday: false });
    }

    return scaleEntriesRepo.listByMonth(tenantId, scaleMonth.id);
  }

  async function duplicateMonth(tenantId: string, sourceMonthId: string, targetMonth: number, targetYear: number, createdBy: string) {
    const sourceMonth = await scaleMonthsRepo.findById(tenantId, sourceMonthId);
    if (!sourceMonth) throw notFound('SCALE_MONTH_NOT_FOUND', 'Mês de escala de origem não encontrado.');

    const sourceEntries = await scaleEntriesRepo.listByMonth(tenantId, sourceMonth.id);
    const targetScaleMonth = await getOrCreateScaleMonth(tenantId, targetMonth, targetYear, createdBy);
    const holidaySet = await holidaySetForMonth(tenantId, targetYear, targetMonth);

    for (const entry of sourceEntries) {
      const day = dayOfMonth(entry.workDate);
      if (!isValidDayInMonth(targetYear, targetMonth, day)) continue; // ex.: dia 31 não existe no mês de destino

      const targetDate = buildDateStr(targetYear, targetMonth, day);
      if (!isWeekday(targetDate) || holidaySet.has(targetDate)) continue; // não força atribuição em fds/feriado do mês de destino

      // Fase 4b: mesma regra do assign()/autoAssign() — não duplica uma atribuição pra quem
      // estará em ausência aprovada na data de destino (fica sem creator nesse dia, não força).
      const creatorIdForTarget = entry.creatorId && (await absencesRepo.findApprovedOverlapping(tenantId, entry.creatorId, targetDate)) ? null : entry.creatorId;

      await scaleEntriesRepo.upsertAssignment({
        tenantId,
        scaleMonthId: targetScaleMonth.id,
        workDate: targetDate,
        creatorId: creatorIdForTarget,
        isHoliday: false,
      });
    }

    return listEntries(tenantId, `${targetYear}-${String(targetMonth).padStart(2, '0')}`, createdBy);
  }

  return {
    listEntries,
    assign,
    autoAssign,
    duplicateMonth,
    holidays: {
      list: async (tenantId: string, monthParam: unknown) => {
        const { year, month } = parseMonthParam(monthParam);
        return holidaysRepo.listForMonth(tenantId, year, month);
      },
      create: async (tenantId: string, holidayDate: string, description: string | null) => {
        if (!isValidWorkDateFormat(holidayDate)) throw badRequest('INVALID_HOLIDAY_DATE', 'holiday_date deve estar no formato YYYY-MM-DD.');
        return holidaysRepo.create({ tenantId, holidayDate, description });
      },
    },
  };
}

export type ScheduleService = ReturnType<typeof createScheduleService>;
