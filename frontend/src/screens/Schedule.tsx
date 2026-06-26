import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api';
import { useApp } from '@/context/AppContext';
import { useAsync } from '@/lib/useAsync';
import { Card, Avatar, Button, Tag, StatusPill } from '@/components/ui';
import { MobileScreen, DetailRow } from '@/components/MobileScreen';
import { TaskDetailScreen } from '@/components/TaskDetailScreen';
import { useToast } from '@/context/ToastContext';
import { useRealtimeRefresh } from '@/context/NotificationsContext';
import { useCan } from '@/lib/permissions';
import { currentWeekWeekdays } from '@/lib/dates';
import { TASK_STATUS_META, TASK_FORMAT_COLOR, shortDate } from '@/lib/display';
import type { ScaleEntry, Creator, Absence, CreatorTask, Holiday, NotificationType } from '@/types';

const SCALE_MONTH = '2026-06';
const TASK_NOTIFICATION_TYPES: NotificationType[] = ['nova_tarefa', 'mudanca_status'];
const ABSENCE_NOTIFICATION_TYPES: NotificationType[] = ['ausencia_aprovada', 'ausencia_rejeitada'];
const SCALE_NOTIFICATION_TYPES: NotificationType[] = ['alteracao_escala'];

export function Schedule() {
  const { user } = useApp();
  return user?.role === 'operacional' ? <OperationalSchedule /> : <CoordinatorSchedule />;
}

interface Drag { creatorId: string; fromDate: string | null }

/** Escala: arraste um creator da paleta pra um dia (adiciona, mais de 1 por dia é permitido).
 * Arraste um creator já escalado pra outro dia pra mover, ou de volta pra paleta pra remover. */
function CoordinatorSchedule() {
  const toast = useToast();
  const canManage = useCan('schedule');
  const schedule = useAsync<ScaleEntry[]>(() => api.schedule.list(SCALE_MONTH), []);
  const creators = useAsync<Creator[]>(() => api.creators.list(), []);
  const absences = useAsync<Absence[]>(() => api.absences.list(), []);
  const holidays = useAsync<Holiday[]>(() => api.holidays.list(SCALE_MONTH), []);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [generating, setGenerating] = useState(false);

  const byDate = new Map<string, string[]>();
  for (const e of schedule.data ?? []) {
    if (!e.creator_id) continue;
    byDate.set(e.work_date, [...(byDate.get(e.work_date) ?? []), e.creator_id]);
  }
  const cre = creators.data ?? [];
  const creById = (id: string) => cre.find((c) => c.id === id) ?? null;
  const approvedAbsences = (absences.data ?? []).filter((a) => a.status === 'approved');
  const hasApprovedAbsenceOn = (creatorId: string, date: string) =>
    approvedAbsences.some((a) => a.creator_id === creatorId && a.start_date <= date && date <= a.end_date);
  const absentCreatorIdsOn = (date: string) => approvedAbsences.filter((a) => a.start_date <= date && date <= a.end_date).map((a) => a.creator_id);
  const holidayByDate = new Map((holidays.data ?? []).map((h) => [h.holiday_date, h.description]));

  const weeks = [[1, 2, 3, 4, 5], [8, 9, 10, 11, 12], [15, 16, 17, 18, 19], [22, 23, 24, 25, 26], [29, 30, null, null, null]];
  const iso = (d: number) => `${SCALE_MONTH}-${String(d).padStart(2, '0')}`;
  const workdays = weeks.flat().filter((d): d is number => d !== null);

  async function dropOnDay(date: string) {
    if (!drag || holidayByDate.has(date)) return;
    const { creatorId, fromDate } = drag;
    setDrag(null);
    if (fromDate === date) return;
    if ((byDate.get(date) ?? []).includes(creatorId)) { toast.warning('Já escalado', 'Esse creator já está nesse dia.'); return; }
    schedule.setData((prev) => {
      const kept = fromDate ? (prev ?? []).filter((e) => !(e.work_date === fromDate && e.creator_id === creatorId)) : (prev ?? []);
      return [...kept, { id: `${date}-${creatorId}`, scale_month_id: 'sm1', creator_id: creatorId, work_date: date, is_holiday: false, created_at: '' }];
    });
    try {
      if (fromDate) await api.schedule.unassign(fromDate, creatorId);
      await api.schedule.assign(date, creatorId);
    } catch (err) { schedule.reload(); toast.error('Não foi possível mover', err instanceof Error ? err.message : 'Tente novamente.'); }
  }

  async function removeFromDay(date: string, creatorId: string) {
    schedule.setData((prev) => (prev ?? []).filter((e) => !(e.work_date === date && e.creator_id === creatorId)));
    try {
      await api.schedule.unassign(date, creatorId);
    } catch (err) { schedule.reload(); toast.error('Não foi possível remover', err instanceof Error ? err.message : 'Tente novamente.'); }
  }

  function dropOnPalette() { if (drag?.fromDate) removeFromDay(drag.fromDate, drag.creatorId); setDrag(null); }

  async function dropOnPaletteItem(targetId: string, e: React.DragEvent) {
    e.stopPropagation();
    if (!drag) return;
    if (drag.fromDate) { removeFromDay(drag.fromDate, drag.creatorId); setDrag(null); return; }
    const { creatorId: draggedId } = drag;
    setDrag(null);
    if (draggedId === targetId) return;
    const ids = cre.map((c) => c.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) return;
    const nextIds = [...ids];
    nextIds.splice(from, 1);
    nextIds.splice(to, 0, draggedId);
    creators.setData(nextIds.map((id) => creById(id)!));
    try {
      await api.creators.reorder(nextIds);
    } catch (err) { creators.reload(); toast.error('Não foi possível reordenar', err instanceof Error ? err.message : 'Tente novamente.'); }
  }

  /** Round-robin nos dias úteis respeitando a ordem atual de `cre` e ausências aprovadas. */
  async function autoFill() {
    if (!cre.length) return;
    const days = workdays.map(iso).filter((date) => !holidayByDate.has(date));
    if (!days.length) return;
    const assignments: { date: string; creatorId: string }[] = [];
    let pointer = 0;
    for (const date of days) {
      for (let attempt = 0; attempt < cre.length; attempt++) {
        const candidate = cre[(pointer + attempt) % cre.length]!;
        if (!hasApprovedAbsenceOn(candidate.id, date)) {
          assignments.push({ date, creatorId: candidate.id });
          pointer = (pointer + attempt + 1) % cre.length;
          break;
        }
      }
    }
    if (!assignments.length) return;
    const toRemove = days.flatMap((date) => (byDate.get(date) ?? []).map((creatorId) => ({ date, creatorId })));
    schedule.setData(() => assignments.map((a) => ({ id: `${a.date}-${a.creatorId}`, scale_month_id: 'sm1', creator_id: a.creatorId, work_date: a.date, is_holiday: false, created_at: '' })));
    await Promise.all(toRemove.map((r) => api.schedule.unassign(r.date, r.creatorId)));
    await Promise.all(assignments.map((a) => api.schedule.assign(a.date, a.creatorId)));
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      await autoFill();
      toast.success('Escala gerada', 'Creators distribuídos nos dias úteis de forma intercalada.');
    } catch (err) {
      toast.error('Não foi possível gerar a escala', err instanceof Error ? err.message : 'Tente novamente.');
    } finally {
      setGenerating(false);
    }
  }

  function duplicateMonth() { autoFill(); toast.success('Escala duplicada', 'Escala de Junho duplicada para o próximo mês (distribuição mantida).'); }

  // — Fase 1: carregando
  const isLoading = creators.loading || schedule.loading;
  if (isLoading) {
    return (
      <div className="cp-fade" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--tx3)" strokeWidth="2" className="cp-spin"><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" /></svg>
      </div>
    );
  }

  // — Fase 2: nenhum creator cadastrado
  if (creators.data !== null && cre.length === 0) {
    return (
      <div className="cp-fade" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 340, gap: 18, textAlign: 'center', padding: '0 24px' }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--bg2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--tx3)" strokeWidth="1.7"><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
        </div>
        <div>
          <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700, fontSize: 17, marginBottom: 6 }}>Nenhum creator cadastrado</div>
          <div style={{ fontSize: 13.5, color: 'var(--tx3)', lineHeight: 1.55, maxWidth: 340 }}>
            Cadastre pelo menos 2 creators em <strong>Cadastros</strong> para poder gerar a escala do mês.
          </div>
        </div>
        <Link to="/cadastros">
          <Button icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>}>
            Ir para Cadastros
          </Button>
        </Link>
      </div>
    );
  }

  // — Fase 3: apenas 1 creator (precisa de 2+)
  if (cre.length === 1) {
    return (
      <div className="cp-fade" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 340, gap: 18, textAlign: 'center', padding: '0 24px' }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--bg2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--tx3)" strokeWidth="1.7"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>
        </div>
        <div>
          <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700, fontSize: 17, marginBottom: 6 }}>Você tem 1 creator</div>
          <div style={{ fontSize: 13.5, color: 'var(--tx3)', lineHeight: 1.55, maxWidth: 340 }}>
            A escala intercalada precisa de pelo menos <strong>2 creators</strong>. Cadastre mais um para poder gerar a escala.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 14, padding: '10px 14px' }}>
          <Avatar name={cre[0]!.name} size={32} seed={cre[0]!.id} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>{cre[0]!.name}</span>
        </div>
        <Link to="/cadastros">
          <Button icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>}>
            Adicionar creator
          </Button>
        </Link>
      </div>
    );
  }

  // — Fase 4: 2+ creators mas escala do mês ainda vazia → onboarding
  if (schedule.data !== null && schedule.data.length === 0) {
    return (
      <div className="cp-fade" style={{ maxWidth: 520, margin: '0 auto', paddingTop: 8 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: 'linear-gradient(135deg,var(--pri),var(--pri2))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', boxShadow: '0 8px 22px rgba(108,99,255,.35)' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /></svg>
          </div>
          <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 20, marginBottom: 6 }}>Gerar primeira escala</div>
          <div style={{ fontSize: 13.5, color: 'var(--tx3)', lineHeight: 1.55 }}>
            Defina a ordem dos creators arrastando — a escala vai intercalá-los nos dias úteis do mês.
          </div>
        </div>

        <Card pad={0} style={{ overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--line)', fontSize: 11, fontWeight: 700, letterSpacing: '.05em', color: 'var(--tx3)', display: 'flex', gap: 10, alignItems: 'center' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M9 5l7 7-7 7" /></svg>
            ORDEM DE ESCALAÇÃO — arraste para reordenar
          </div>
          {cre.map((c, i) => (
            <div key={c.id} draggable
              onDragStart={() => setDrag({ creatorId: c.id, fromDate: null })}
              onDragEnd={() => setDrag(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => dropOnPaletteItem(c.id, e)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: i < cre.length - 1 ? '1px solid var(--line)' : 'none', cursor: 'grab', userSelect: 'none', background: drag?.creatorId === c.id && !drag.fromDate ? 'var(--bg2)' : 'transparent' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--tx3)" strokeWidth="2"><path d="M9 5h2M13 5h2M9 12h2M13 12h2M9 19h2M13 19h2" /></svg>
              <div style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--tx3)', flex: 'none' }}>{i + 1}</div>
              <Avatar name={c.name} size={34} seed={c.id} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{c.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--tx3)' }}>{c.employment_type === 'fixed' ? 'Fixo' : 'Freelancer'}</div>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--tx3)', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 8, padding: '3px 9px' }}>
                {i === 0 ? '1º dia' : `${i + 1}º dia`}
              </div>
            </div>
          ))}
        </Card>

        <div style={{ background: 'rgba(108,99,255,.07)', border: '1px solid rgba(108,99,255,.2)', borderRadius: 13, padding: '10px 14px', marginBottom: 20, fontSize: 12.5, color: 'var(--tx2)', lineHeight: 1.5 }}>
          <strong>Como funciona:</strong> cada creator recebe um dia útil na sequência acima, em ciclo. Feriados e ausências aprovadas são pulados automaticamente.
        </div>

        <Button onClick={handleGenerate} disabled={generating} style={{ width: '100%', justifyContent: 'center', height: 48 }}
          icon={generating ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="cp-spin"><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" /></svg> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" /></svg>}>
          {generating ? 'Gerando escala…' : 'Gerar escala intercalada'}
        </Button>
      </div>
    );
  }

  // — Fase 5: escala existe → calendário normal
  return (
    <div className="cp-fade">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: '7px 14px' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--tx2)" strokeWidth="2.2"><path d="M15 18l-6-6 6-6" /></svg>
          <span style={{ fontWeight: 700, fontSize: 14, fontFamily: "'Plus Jakarta Sans'" }}>Junho 2026</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--tx2)" strokeWidth="2.2"><path d="M9 18l6-6-6-6" /></svg>
        </div>
        {canManage && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 9 }}>
            <Button variant="ghost" onClick={duplicateMonth} icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 2h6v4H9z" /></svg>}>Duplicar mês</Button>
            <Button onClick={autoFill} icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" /></svg>}>Escala automática</Button>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 18 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Card pad={16}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 10 }}>
            {['SEG', 'TER', 'QUA', 'QUI', 'SEX'].map((d) => <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--tx3)' }}>{d}</div>)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
                {week.map((d, di) => {
                  if (d === null) return <div key={di} style={{ visibility: 'hidden' }} />;
                  const date = iso(d);
                  const holidayName = holidayByDate.get(date);
                  const dayCreatorIds = byDate.get(date) ?? [];
                  const dropEnabled = canManage && !holidayName;
                  return (
                    <div key={di} onDragOver={dropEnabled ? (e) => e.preventDefault() : undefined} onDrop={dropEnabled ? () => dropOnDay(date) : undefined}
                      style={{ minHeight: 96, background: holidayName ? 'rgba(239,68,68,.06)' : 'var(--bg2)', border: `1px solid ${holidayName ? 'rgba(239,68,68,.25)' : 'var(--line)'}`, borderRadius: 13, padding: 9, display: 'flex', flexDirection: 'column', gap: 6, opacity: holidayName ? 0.75 : 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx2)' }}>{d}</span>
                      {holidayName && <div style={{ fontSize: 9.5, color: 'var(--red)', fontWeight: 600, lineHeight: 1.3 }}>{holidayName}</div>}
                      {!holidayName && absentCreatorIdsOn(date).filter((id) => !dayCreatorIds.includes(id)).map((creatorId) => {
                        const c = creById(creatorId);
                        if (!c) return null;
                        return (
                          <div key={`absent-${creatorId}`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 6px 6px 8px', borderRadius: 11, opacity: 0.6, background: 'rgba(120,120,140,.10)', border: '1px solid var(--line)' }}>
                            <Avatar name={c.name} size={22} seed={c.id} />
                            <span style={{ flex: 1, fontSize: 10.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--tx3)' }}>{c.name}</span>
                            <span style={{ flex: 'none', fontSize: 9, fontWeight: 700, color: 'var(--amber)' }}>Ausente</span>
                          </div>
                        );
                      })}
                      {!holidayName && dayCreatorIds.map((creatorId) => {
                        const c = creById(creatorId);
                        if (!c) return null;
                        const conflict = hasApprovedAbsenceOn(c.id, date);
                        return (
                          <div key={creatorId} draggable={canManage} onDragStart={() => setDrag({ creatorId: c.id, fromDate: date })} onDragEnd={() => setDrag(null)}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 6px 6px 8px', borderRadius: 11, opacity: conflict ? 0.55 : 1, background: conflict ? 'rgba(120,120,140,.12)' : 'rgba(108,99,255,.12)', border: `1px solid ${conflict ? 'rgba(120,120,140,.3)' : 'rgba(108,99,255,.3)'}`, cursor: canManage ? 'grab' : 'default' }}>
                            <Avatar name={c.name} size={22} seed={c.id} />
                            <span style={{ flex: 1, fontSize: 10.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                            {canManage && (
                              <button onClick={() => removeFromDay(date, c.id)} title="Remover desse dia"
                                style={{ flex: 'none', width: 16, height: 16, borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--tx3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg>
                              </button>
                            )}
                          </div>
                        );
                      })}
                      {!holidayName && dayCreatorIds.some((id) => hasApprovedAbsenceOn(id, date)) && <div style={{ fontSize: 9.5, color: 'var(--amber)', fontWeight: 600 }}>Ausência aprovada</div>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {canManage && (
        <div style={{ width: 230, flex: 'none' }}>
          <Card pad={16} onDragOver={(e) => e.preventDefault()} onDrop={dropOnPalette}>
            <div style={{ fontWeight: 700, fontSize: 13.5, fontFamily: "'Plus Jakarta Sans'", marginBottom: 14 }}>Creators disponíveis</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {cre.map((c) => (
                <div key={c.id} draggable onDragStart={() => setDrag({ creatorId: c.id, fromDate: null })} onDragEnd={() => setDrag(null)}
                  onDragOver={(e) => e.preventDefault()} onDrop={(e) => dropOnPaletteItem(c.id, e)}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px', borderRadius: 12, background: 'rgba(108,99,255,.10)', border: '1px solid rgba(108,99,255,.27)', cursor: 'grab', userSelect: 'none' }}>
                  <Avatar name={c.name} size={30} seed={c.id} />
                  <div style={{ lineHeight: 1.2 }}><div style={{ fontSize: 12.5, fontWeight: 600 }}>{c.name}</div><div style={{ fontSize: 10.5, color: 'var(--tx3)' }}>{c.employment_type === 'fixed' ? 'Fixo' : 'Freelancer'}</div></div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
      </div>
    </div>
  );
}


type DayKind = 'scheduled' | 'absence' | 'tasks' | 'holiday' | 'none';
interface DayStatus { kind: DayKind; text: string; detail: string | null; absence?: Absence; tasks?: CreatorTask[]; }

const BADGE_STYLE: Record<DayKind, { background: string; border?: string; color: string }> = {
  scheduled: { background: 'linear-gradient(135deg,var(--pri),var(--pri2))', color: '#fff' },
  absence: { background: 'rgba(120,120,140,.12)', border: '1px solid var(--line)', color: 'var(--tx3)' },
  tasks: { background: 'var(--bg2)', border: '1px solid var(--line)', color: 'var(--tx2)' },
  holiday: { background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', color: 'var(--red)' },
  none: { background: 'var(--bg2)', border: '1px solid var(--line)', color: 'var(--tx2)' },
};

const CARD_STYLE: Record<DayKind, { background: string; border: string }> = {
  scheduled: { background: 'var(--bg2)', border: '1px solid rgba(108,99,255,.3)' },
  absence: { background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.25)' },
  tasks: { background: 'var(--bg2)', border: '1px solid var(--line)' },
  holiday: { background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)' },
  none: { background: 'var(--bg2)', border: '1px solid var(--line)' },
};

const TEXT_COLOR: Record<DayKind, string> = {
  scheduled: 'var(--tx)', absence: 'var(--amber)', tasks: 'var(--tx2)', holiday: 'var(--red)', none: 'var(--tx2)',
};

/** Cronograma do app mobile (papel operacional) — status do próprio dia na semana atual. */
function OperationalSchedule() {
  const { user } = useApp();
  const schedule = useAsync<ScaleEntry[]>(() => api.schedule.list(SCALE_MONTH), []);
  const tasks = useAsync<CreatorTask[]>(() => api.tasks.list(), []); // já só as próprias
  const absences = useAsync<Absence[]>(() => api.absences.list(), []); // já só as próprias
  // tarefa nova/status mudou, ausência aprovada/rejeitada e escala alterada (ex.: vc foi escalado
  // como substituto) mudam o que esse dia mostra — sem isso só refletia depois de recarregar a tela.
  useRealtimeRefresh(TASK_NOTIFICATION_TYPES, tasks.reload);
  useRealtimeRefresh(ABSENCE_NOTIFICATION_TYPES, absences.reload);
  useRealtimeRefresh(SCALE_NOTIFICATION_TYPES, schedule.reload);
  const myCreatorId = user?.creator_id ?? null;
  const weekDays = currentWeekWeekdays();

  function statusFor(day: string): DayStatus {
    const entry = (schedule.data ?? []).find((e) => e.work_date === day);
    if (entry?.is_holiday) return { kind: 'holiday', text: 'Feriado', detail: null };

    const absence = (absences.data ?? []).find((a) => a.status === 'approved' && a.start_date <= day && day <= a.end_date);
    if (absence) return { kind: 'absence', text: 'Ausência aprovada', detail: absence.reason, absence };

    if (entry && myCreatorId && entry.creator_id === myCreatorId) return { kind: 'scheduled', text: 'Escalado', detail: null };

    const dayTasks = (tasks.data ?? []).filter((t) => t.task_date === day);
    if (dayTasks.length > 0) {
      const formats = dayTasks.map((t) => t.format_type).filter(Boolean).join(' · ');
      return { kind: 'tasks', text: `${dayTasks.length} tarefa${dayTasks.length > 1 ? 's' : ''} atribuída${dayTasks.length > 1 ? 's' : ''}`, detail: formats || null, tasks: dayTasks };
    }

    return { kind: 'none', text: 'Sem atividades', detail: null };
  }

  const [detailDay, setDetailDay] = useState<{ label: string; dayNum: number; status: DayStatus } | null>(null);

  return (
    <div className="cp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        {weekDays.map((d) => {
          const status = statusFor(d.iso);
          const clickable = status.kind !== 'none';
          return (
            <div key={d.iso} onClick={clickable ? () => setDetailDay({ label: d.label, dayNum: d.dayNum, status }) : undefined} style={{ display: 'flex', gap: 14, cursor: clickable ? 'pointer' : 'default' }}>
              <div style={{ width: 58, flex: 'none', textAlign: 'center', borderRadius: 14, padding: '11px 0', ...BADGE_STYLE[status.kind] }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, opacity: status.kind === 'scheduled' ? 0.85 : 1 }}>{d.label}</div>
                <div style={{ fontSize: 21, fontWeight: 800, fontFamily: "'Plus Jakarta Sans'" }}>{d.dayNum}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0, borderRadius: 16, padding: 14, ...CARD_STYLE[status.kind] }}>
                <div style={{ fontSize: 14.5, fontWeight: status.kind === 'scheduled' || status.kind === 'absence' ? 700 : 600, color: TEXT_COLOR[status.kind] }}>{status.text}</div>
                {status.detail && <div style={{ fontSize: 13, color: 'var(--tx3)', marginTop: 3 }}>{status.detail}</div>}
              </div>
            </div>
          );
        })}

        {detailDay && <ScheduleDayDetailScreen day={detailDay} onClose={() => setDetailDay(null)} />}
    </div>
  );
}

/** Detalhes de um dia do cronograma (app mobile) — escala, ausência, feriado ou tarefas do dia. */
function ScheduleDayDetailScreen({ day, onClose }: { day: { label: string; dayNum: number; status: DayStatus }; onClose: () => void }) {
  const { status } = day;
  const [taskDetail, setTaskDetail] = useState<CreatorTask | null>(null);

  return (
    <MobileScreen title={`${day.label} · dia ${day.dayNum}`} onBack={onClose}>
      <div style={{ display: 'inline-flex', borderRadius: 10, padding: '7px 13px', fontSize: 13, fontWeight: 700, color: TEXT_COLOR[status.kind], marginBottom: 20, ...CARD_STYLE[status.kind] }}>
        {status.text}
      </div>

      {status.kind === 'absence' && status.absence && (
        <>
          <DetailRow label="Período" value={`${shortDate(status.absence.start_date)} – ${shortDate(status.absence.end_date)}`} />
          <DetailRow label="Motivo" value={status.absence.reason ?? '—'} />
        </>
      )}

      {status.kind === 'holiday' && (
        <div style={{ fontSize: 14.5, color: 'var(--tx2)', lineHeight: 1.5 }}>Feriado — sem atividades programadas para esse dia.</div>
      )}

      {status.kind === 'scheduled' && (
        <div style={{ fontSize: 14.5, color: 'var(--tx2)', lineHeight: 1.5 }}>Você está na escala de produção desse dia.</div>
      )}

      {status.kind === 'tasks' && status.tasks && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {status.tasks.map((task) => (
            <div key={task.id} onClick={() => setTaskDetail(task)} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 14, padding: 13, cursor: 'pointer' }}>
              {task.format_type && <Tag label={task.format_type} color={TASK_FORMAT_COLOR[task.format_type]} />}
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{task.title}</span>
              <StatusPill meta={TASK_STATUS_META[task.status]} />
            </div>
          ))}
        </div>
      )}

      {taskDetail && <TaskDetailScreen task={taskDetail} onClose={() => setTaskDetail(null)} />}
    </MobileScreen>
  );
}
