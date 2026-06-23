import type { db as Db } from '../../db/client.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { shortDate } from '../../lib/notificationText.js';
import { createNoopEmitter, type RealtimeEmitter } from '../../realtime/emitter.js';
import { createNoopPushSender, type PushSender } from '../../realtime/pushSender.js';
import { createAbsencesRepository } from '../absences/absences.repository.js';
import { createCreatorsRepository } from '../creators/creators.repository.js';
import { createNotificationsService } from '../notifications/notifications.service.js';
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

export function createScheduleService(
  db: typeof Db,
  emitter: RealtimeEmitter = createNoopEmitter(),
  pushSender: PushSender = createNoopPushSender(),
) {
  const scaleMonthsRepo = createScaleMonthsRepository(db);
  const scaleEntriesRepo = createScaleEntriesRepository(db);
  const holidaysRepo = createHolidaysRepository(db);
  const creatorsRepo = createCreatorsRepository(db);
  const absencesRepo = createAbsencesRepository(db);
  const notificationsService = createNotificationsService(db, emitter, pushSender);

  async function getOrCreateScaleMonth(tenantId: string, month: number, year: number, createdBy: string) {
    const existing = await scaleMonthsRepo.findByMonth(tenantId, month, year);
    if (existing) return existing;
    return scaleMonthsRepo.create({ tenantId, month, year, createdBy });
  }

  async function holidaySetForMonth(tenantId: string, year: number, month: number): Promise<Set<string>> {
    const rows = await holidaysRepo.listForMonth(tenantId, year, month);
    return new Set(rows.map((r) => r.holidayDate));
  }

  /** Linhas existentes do mês (cada uma é uma atribuição real — mais de 1 creator por dia é permitido), com is_holiday sempre recalculado. */
  async function listEntries(tenantId: string, monthParam: unknown, createdBy: string) {
    const { year, month } = parseMonthParam(monthParam);
    const scaleMonth = await getOrCreateScaleMonth(tenantId, month, year, createdBy);
    const holidaySet = await holidaySetForMonth(tenantId, year, month);

    const existing = await scaleEntriesRepo.listByMonth(tenantId, scaleMonth.id);
    const entries = existing.map((e) => ({ ...e, isHoliday: holidaySet.has(e.workDate) }));

    return { scaleMonth, entries };
  }

  /** Adiciona 1 creator a 1 dia — não substitui quem já estiver escalado nesse dia (mais de 1 por dia é permitido). */
  async function assign(tenantId: string, workDate: unknown, creatorId: string, createdBy: string) {
    if (!isValidWorkDateFormat(workDate)) throw badRequest('INVALID_WORK_DATE', 'work_date deve estar no formato YYYY-MM-DD.');
    if (!isWeekday(workDate)) throw badRequest('INVALID_WORK_DATE', 'Não é possível escalar em fim de semana.');

    const [yearStr, monthStr] = workDate.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);

    const holidaySet = await holidaySetForMonth(tenantId, year, month);
    if (holidaySet.has(workDate)) throw badRequest('INVALID_WORK_DATE', 'Não é possível escalar em feriado.');

    const creator = await creatorsRepo.findRowById(tenantId, creatorId);
    if (!creator) throw badRequest('INVALID_CREATOR', 'Creator inválido para este tenant.');

    const alreadyAssigned = await scaleEntriesRepo.findByWorkDateAndCreator(tenantId, workDate, creatorId);
    if (alreadyAssigned) throw conflict('ALREADY_ASSIGNED', 'Este creator já está escalado nesse dia.');

    const overlapping = await absencesRepo.findApprovedOverlapping(tenantId, creatorId, workDate);
    if (overlapping) throw conflict('ABSENCE_OVERLAPS_SCHEDULE', 'Creator já possui ausência aprovada nesse período.');

    const scaleMonth = await getOrCreateScaleMonth(tenantId, month, year, createdBy);
    const created = await scaleEntriesRepo.create({ tenantId, scaleMonthId: scaleMonth.id, workDate, creatorId, isHoliday: false });

    // Sem isso, o creator (titular ou substituto cobrindo ausência de outro) só descobria que foi
    // escalado abrindo o app e olhando o quadro — mesmo gatilho que tarefa/plantão/ausência já têm.
    await notificationsService.notify(tenantId, creator.userId, 'alteracao_escala', 'Você foi escalado(a)', shortDate(workDate));

    return created;
  }

  /** Remove 1 creator de 1 dia, sem afetar outros creators atribuídos no mesmo dia (drag de "deletar"/"mover" no quadro). */
  async function unassign(tenantId: string, workDate: unknown, creatorId: string) {
    if (!isValidWorkDateFormat(workDate)) throw badRequest('INVALID_WORK_DATE', 'work_date deve estar no formato YYYY-MM-DD.');

    const deleted = await scaleEntriesRepo.deleteByWorkDateAndCreator(tenantId, workDate, creatorId);
    if (!deleted) throw notFound('ASSIGNMENT_NOT_FOUND', 'Este creator não está escalado nesse dia.');
    return deleted;
  }

  /**
   * Round-robin pulando feriados/fins de semana e creators com ausência aprovada cobrindo o dia
   * (Fase 4b). Se todos os creators estiverem indisponíveis num dia, ele fica sem nenhuma linha
   * (não força atribuição) — o quadro mostra esse dia vazio, pronto pra atribuição manual via drag.
   *
   * Limpa o mês inteiro antes de regenerar: senão, rodar de novo depois de adicionar creators
   * manualmente (drag) deixaria linhas obsoletas/duplicadas misturadas com a nova distribuição.
   *
   * O gatilho 'alteracao_escala' (avisar coordenador quando uma ausência aprovada conflita com dia
   * já escalado) não vive aqui — é emitido em absences.service.ts#review, no momento da aprovação.
   */
  async function autoAssign(tenantId: string, scaleMonthId: string) {
    const scaleMonth = await scaleMonthsRepo.findById(tenantId, scaleMonthId);
    if (!scaleMonth) throw notFound('SCALE_MONTH_NOT_FOUND', 'Mês de escala não encontrado.');

    const creatorIds = await creatorsRepo.listActiveIds(tenantId);
    if (creatorIds.length === 0) throw badRequest('NO_ACTIVE_CREATORS', 'Nenhum creator ativo para distribuir a escala.');

    const holidaySet = await holidaySetForMonth(tenantId, scaleMonth.year, scaleMonth.month);
    const workableDays = getWeekdaysInMonth(scaleMonth.year, scaleMonth.month).filter((d) => !holidaySet.has(d));

    await scaleEntriesRepo.deleteByMonth(tenantId, scaleMonth.id);

    let pointer = 0;
    const rows: { tenantId: string; scaleMonthId: string; workDate: string; creatorId: string }[] = [];
    for (const workDate of workableDays) {
      for (let attempt = 0; attempt < creatorIds.length; attempt++) {
        const candidate = creatorIds[(pointer + attempt) % creatorIds.length]!;
        const overlapping = await absencesRepo.findApprovedOverlapping(tenantId, candidate, workDate);
        if (!overlapping) {
          rows.push({ tenantId, scaleMonthId: scaleMonth.id, workDate, creatorId: candidate });
          pointer = (pointer + attempt + 1) % creatorIds.length;
          break;
        }
      }
    }

    await scaleEntriesRepo.createMany(rows);
    return scaleEntriesRepo.listByMonth(tenantId, scaleMonth.id);
  }

  async function duplicateMonth(tenantId: string, sourceMonthId: string, targetMonth: number, targetYear: number, createdBy: string) {
    const sourceMonth = await scaleMonthsRepo.findById(tenantId, sourceMonthId);
    if (!sourceMonth) throw notFound('SCALE_MONTH_NOT_FOUND', 'Mês de escala de origem não encontrado.');

    const sourceEntries = await scaleEntriesRepo.listByMonth(tenantId, sourceMonth.id);
    const targetScaleMonth = await getOrCreateScaleMonth(tenantId, targetMonth, targetYear, createdBy);
    const holidaySet = await holidaySetForMonth(tenantId, targetYear, targetMonth);

    await scaleEntriesRepo.deleteByMonth(tenantId, targetScaleMonth.id);

    const rows: { tenantId: string; scaleMonthId: string; workDate: string; creatorId: string }[] = [];
    for (const entry of sourceEntries) {
      if (!entry.creatorId) continue; // defensivo: linhas novas sempre têm creator, mas não custa checar
      const day = dayOfMonth(entry.workDate);
      if (!isValidDayInMonth(targetYear, targetMonth, day)) continue; // ex.: dia 31 não existe no mês de destino

      const targetDate = buildDateStr(targetYear, targetMonth, day);
      if (!isWeekday(targetDate) || holidaySet.has(targetDate)) continue; // não força atribuição em fds/feriado do mês de destino

      // Fase 4b: mesma regra do assign()/autoAssign() — não duplica uma atribuição pra quem
      // estará em ausência aprovada na data de destino (só pula esse creator, os outros do mesmo
      // dia de origem ainda são duplicados normalmente).
      const overlapping = await absencesRepo.findApprovedOverlapping(tenantId, entry.creatorId, targetDate);
      if (overlapping) continue;

      rows.push({ tenantId, scaleMonthId: targetScaleMonth.id, workDate: targetDate, creatorId: entry.creatorId });
    }

    await scaleEntriesRepo.createMany(rows);
    return listEntries(tenantId, `${targetYear}-${String(targetMonth).padStart(2, '0')}`, createdBy);
  }

  return {
    listEntries,
    assign,
    unassign,
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
