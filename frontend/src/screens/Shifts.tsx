import { useState } from 'react';
import { Clock, Calendar, Add, FormNext } from 'grommet-icons';
import { api } from '@/api';
import { useApp } from '@/context/AppContext';
import { useAsync } from '@/lib/useAsync';
import { Card, Avatar, Button } from '@/components/ui';
import { Chip } from '@/components/Chip';
import { Modal, Field, Select, TextArea } from '@/components/Modal';
import { DatePicker } from '@/components/DatePicker';
import { MobileScreen, DetailRow } from '@/components/MobileScreen';
import { SHIFT_STATUS_META, shortDate } from '@/lib/display';
import { toLocalIso } from '@/lib/dates';
import { useToast } from '@/context/ToastContext';
import { useConfirm } from '@/context/ConfirmContext';
import { useRealtimeRefresh } from '@/context/NotificationsContext';
import { useCan } from '@/lib/permissions';
import type { Shift, Creator, ShiftStatus, NewShift, StatusHistoryEntry, NotificationType } from '@/types';

const SHIFT_NOTIFICATION_TYPES: NotificationType[] = ['novo_plantao'];
const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sáb'];
function label(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const wd = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return `${wd[new Date(y, m - 1, d).getDay()]} ${d}`;
}

/** Segunda-feira da semana que contém essa data — chave de agrupamento (plantões são quase só
 * fim de semana, então cada grupo normalmente cai certinho num único fim de semana). */
function mondayOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const offset = d.getDay() === 0 ? -6 : 1 - d.getDay();
  d.setDate(d.getDate() + offset);
  return toLocalIso(d);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toLocalIso(d);
}

const STATUSES: ShiftStatus[] = ['scheduled', 'completed', 'cancelled'];

export function Shifts() {
  const { user } = useApp();
  const toast = useToast();
  const confirm = useConfirm();
  const canManage = useCan('shifts');
  // só admin/gestor tem permissão de 'shifts' — !canManage aqui equivale a "é o app mobile" (operacional).
  const isMobile = !canManage;
  const shifts = useAsync<Shift[]>(() => api.shifts.list(), []);
  // plantão novo chega ao vivo (notification:new) — só afeta operacional na prática, já que
  // novo_plantao nunca é emitido pra quem criou o plantão (coordenador).
  useRealtimeRefresh(SHIFT_NOTIFICATION_TYPES, shifts.reload);
  // GET /creators é bloqueado pro operacional (nem leitura) — e não precisa: todo plantão que ele
  // vê já é o dele mesmo (o backend filtra), então o nome é só o do próprio usuário logado.
  const creators = useAsync<Creator[]>(() => (canManage ? api.creators.list() : Promise.resolve([])), []);
  const [modal, setModal] = useState<null | { mode: 'novo' } | { mode: 'editar'; shift: Shift } | { mode: 'historico'; shift: Shift }>(null);
  const [detail, setDetail] = useState<Shift | null>(null);

  const cre = creators.data ?? [];

  // Agrupado por semana (não por dia) — plantões quase só caem no fim de semana, então listar tudo
  // junto numa grade só virava uma bagunça sem nenhuma referência de "qual fim de semana é esse".
  const weekGroups: { weekStart: string; shifts: Shift[] }[] = [];
  if (canManage) {
    const byWeek = new Map<string, Shift[]>();
    for (const s of shifts.data ?? []) byWeek.set(mondayOf(s.shift_date), [...(byWeek.get(mondayOf(s.shift_date)) ?? []), s]);
    for (const [weekStart, list] of byWeek) weekGroups.push({ weekStart, shifts: list.sort((a, b) => a.shift_date.localeCompare(b.shift_date)) });
    weekGroups.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  }

  async function create(data: NewShift) {
    const s = await api.shifts.create(data, user!.id);
    shifts.setData((p) => [s, ...(p ?? [])]);
    setModal(null);
    toast.success('Plantão criado', `${label(s.shift_date)} adicionado.`);
  }

  async function saveEdit(shiftId: string, data: NewShift) {
    try {
      const updated = await api.shifts.update(shiftId, data);
      shifts.setData((p) => (p ?? []).map((s) => (s.id === updated.id ? updated : s)));
      setModal(null);
      toast.success('Plantão atualizado', `${label(updated.shift_date)} atualizado.`);
    } catch (err) {
      toast.error('Não foi possível atualizar', err instanceof Error ? err.message : 'Tente novamente.');
    }
  }

  async function handleDelete(s: Shift) {
    if (!(await confirm({ title: 'Excluir plantão', description: `Excluir o plantão de ${label(s.shift_date)}? Essa ação não pode ser desfeita.` }))) return;
    try {
      await api.shifts.remove(s.id);
      shifts.setData((p) => (p ?? []).filter((x) => x.id !== s.id));
      setModal(null);
      toast.success('Plantão excluído', `${label(s.shift_date)} foi removido.`);
    } catch (err) {
      toast.error('Não foi possível excluir', err instanceof Error ? err.message : 'Tente novamente.');
    }
  }

  async function changeStatus(shiftId: string, status: ShiftStatus) {
    try {
      const updated = await api.shifts.setStatus(shiftId, status);
      shifts.setData((p) => (p ?? []).map((s) => (s.id === updated.id ? updated : s)));
      toast.success('Status atualizado', `${label(updated.shift_date)} agora está ${SHIFT_STATUS_META[status].label.toLowerCase()}.`);
    } catch (err) {
      toast.error('Não foi possível atualizar', err instanceof Error ? err.message : 'Tente novamente.');
    }
  }

  function renderCard(s: Shift) {
    return (
      <Card key={s.id} pad={isMobile ? 20 : 17} onClick={isMobile ? () => setDetail(s) : undefined} style={{ background: 'linear-gradient(160deg,var(--bg2),var(--bg1))', cursor: isMobile ? 'pointer' : 'default' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: isMobile ? 16 : 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: isMobile ? 48 : 40, height: isMobile ? 48 : 40, borderRadius: 12, background: 'rgba(139,92,246,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--pri2)' }}>
              <Clock color="currentColor" style={{ width: isMobile ? 22 : 18, height: isMobile ? 22 : 18 }} />
            </div>
            <div style={{ lineHeight: 1.2 }}><div style={{ fontSize: isMobile ? 16.5 : 14, fontWeight: 700, fontFamily: "'Plus Jakarta Sans'" }}>{label(s.shift_date)}</div><div style={{ fontSize: isMobile ? 13 : 11, color: 'var(--tx3)' }}>{s.notes ?? 'Plantão'}</div></div>
          </div>
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            {canManage ? (
              <Select value={s.status} onChange={(e) => changeStatus(s.id, e.target.value as ShiftStatus)} style={{ fontSize: 11, fontWeight: 700, color: SHIFT_STATUS_META[s.status].color, background: SHIFT_STATUS_META[s.status].bg, border: 'none', borderRadius: 7, padding: '3px 6px', width: 'auto' }}>
                {STATUSES.map((st) => <option key={st} value={st}>{SHIFT_STATUS_META[st].label}</option>)}
              </Select>
            ) : <span style={{ fontSize: 13, fontWeight: 700, color: SHIFT_STATUS_META[s.status].color, background: SHIFT_STATUS_META[s.status].bg, padding: '4px 11px', borderRadius: 8 }}>{SHIFT_STATUS_META[s.status].label}</span>}
          </span>
        </div>
        <div style={{ height: 1, background: 'var(--line)', marginBottom: isMobile ? 16 : 13 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar name={s.creator_name ?? 'A designar'} size={isMobile ? 38 : 30} seed={s.creator_id ?? ''} />
          <div style={{ flex: 1 }}><div style={{ fontSize: isMobile ? 15 : 12.5, fontWeight: 600 }}>{s.creator_name ?? 'A designar'}</div><div style={{ fontSize: isMobile ? 13 : 11, color: 'var(--tx3)' }}>Creator de plantão</div></div>
          {canManage && (
            <>
              <button onClick={() => setModal({ mode: 'historico', shift: s })} title="Histórico" style={{ width: 32, height: 32, flex: 'none', color: 'var(--tx2)', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock color="currentColor" size="small" />
              </button>
              <button onClick={() => setModal({ mode: 'editar', shift: s })} style={{ fontSize: 11.5, color: 'var(--pri)', background: 'rgba(108,99,255,.1)', border: '1px solid rgba(108,99,255,.25)', borderRadius: 8, padding: '5px 10px', fontWeight: 600, cursor: 'pointer' }}>Editar</button>
            </>
          )}
        </div>
        {s.standby_creator_ids.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 11, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.03em' }}>Sobreaviso</span>
            {s.standby_creator_ids.map((id, i) => (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 8, padding: '3px 8px 3px 4px' }}>
                <Avatar name={s.standby_names[i] ?? 'Creator'} size={18} seed={id} />
                <span style={{ fontSize: 11, fontWeight: 600 }}>{s.standby_names[i] ?? 'Creator'}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    );
  }

  return (
    <div className="cp-fade">
      {canManage && (
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 13, color: 'var(--tx2)' }}>Plantões de fim de semana · <strong style={{ color: 'var(--tx)' }}>Junho 2026</strong></div>
          <div style={{ marginLeft: 'auto' }}>
            <Button icon={<Add color="currentColor" size="small" />} onClick={() => setModal({ mode: 'novo' })}>Criar plantão</Button>
          </div>
        </div>
      )}

      {canManage ? (
        weekGroups.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--tx3)' }}>Nenhum plantão cadastrado ainda.</div>
        ) : (
          weekGroups.map(({ weekStart, shifts: weekShifts }) => {
            const weekEnd = addDays(weekStart, 6);
            return (
              <div key={weekStart} style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, paddingLeft: 12, borderLeft: '3px solid var(--pri)' }}>
                  <Calendar color="var(--pri2)" size="small" />
                  <span style={{ fontSize: 13.5, fontWeight: 800, fontFamily: "'Plus Jakarta Sans'" }}>{shortDate(weekStart)} – {shortDate(weekEnd)}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--tx3)', background: 'var(--bg2)', border: '1px solid var(--line)', padding: '2px 9px', borderRadius: 7 }}>
                    {weekShifts.length} plantão{weekShifts.length > 1 ? 'ões' : ''}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
                  {weekShifts.map((s) => renderCard(s))}
                </div>
              </div>
            );
          })
        )
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
          {(shifts.data ?? []).map((s) => renderCard(s))}
        </div>
      )}

      {modal?.mode === 'novo' && <NewShiftModal creators={cre.filter((c) => c.active)} onClose={() => setModal(null)} onCreate={create} />}
      {modal?.mode === 'editar' && <EditShiftModal shift={modal.shift} creators={cre.filter((c) => c.active)} onClose={() => setModal(null)} onSave={(data) => saveEdit(modal.shift.id, data)} onDelete={() => handleDelete(modal.shift)} />}
      {modal?.mode === 'historico' && <HistoryModal shift={modal.shift} onClose={() => setModal(null)} />}
      {detail && <ShiftDetailScreen shift={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

/** Detalhes do próprio plantão (app mobile) — sem histórico/troca, ações exclusivas do coordenador.
 * Quem vê pode ser titular OU sobreaviso agora (GET /shifts passou a incluir os dois) — o papel
 * precisa refletir isso, não assumir sempre "Você" como titular. */
function ShiftDetailScreen({ shift, onClose }: { shift: Shift; onClose: () => void }) {
  const { user } = useApp();
  const isStandby = !!user?.creator_id && shift.standby_creator_ids.includes(user.creator_id);
  return (
    <MobileScreen title="Detalhes do plantão" onBack={onClose}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: SHIFT_STATUS_META[shift.status].color, background: SHIFT_STATUS_META[shift.status].bg, padding: '4px 11px', borderRadius: 8 }}>{SHIFT_STATUS_META[shift.status].label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Plus Jakarta Sans'", marginBottom: 18 }}>{label(shift.shift_date)}</div>
      <DetailRow label="Seu papel" value={isStandby ? 'Sobreaviso' : 'Plantonista titular'} />
      <DetailRow label="Plantonista titular" value={shift.creator_name ?? 'A designar'} />
      {shift.standby_names.length > 0 && <DetailRow label="Sobreaviso" value={shift.standby_names.join(', ')} />}
      <DetailRow label="Observações" value={shift.notes ?? '—'} />
    </MobileScreen>
  );
}

/** Select pra adicionar + chips removíveis — mesmo padrão de filtro ativo (Chip.tsx), reaproveitado pra sobreaviso. */
function StandbyPicker({ creators, excludeId, value, onChange }: { creators: Creator[]; excludeId: string | null; value: string[]; onChange: (ids: string[]) => void }) {
  const available = creators.filter((c) => c.id !== excludeId && !value.includes(c.id));
  return (
    <Field label="Sobreaviso (opcional) — recebem a mesma notificação do plantonista">
      {value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {value.map((id) => (
            <Chip key={id} label={creators.find((c) => c.id === id)?.name ?? id} onRemove={() => onChange(value.filter((x) => x !== id))} />
          ))}
        </div>
      )}
      {available.length > 0 && (
        <Select value="" onChange={(e) => { if (e.target.value) onChange([...value, e.target.value]); }}>
          <option value="">+ Adicionar sobreaviso</option>
          {available.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      )}
    </Field>
  );
}

function NewShiftModal({ creators, onClose, onCreate }: { creators: Creator[]; onClose: () => void; onCreate: (d: NewShift) => void }) {
  const [f, setF] = useState<NewShift>({ shift_date: '2026-06-28', creator_id: creators[0]?.id ?? null, status: 'scheduled', notes: 'Turno manhã (08h–14h)', standby_creator_ids: [] });
  const set = (k: keyof NewShift, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Modal open title="Novo plantão" subtitle="tabela shifts" onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={() => onCreate(f)}>Criar plantão</Button></>}>
      <Field label="Creator (plantonista)"><Select value={f.creator_id ?? ''} onChange={(e) => set('creator_id', e.target.value || null)}>{creators.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Data"><DatePicker value={f.shift_date} onChange={(v) => set('shift_date', v)} /></Field>
        <Field label="Status"><Select value={f.status} onChange={(e) => set('status', e.target.value as ShiftStatus)}>{STATUSES.map((s) => <option key={s} value={s}>{SHIFT_STATUS_META[s].label}</option>)}</Select></Field>
      </div>
      <StandbyPicker creators={creators} excludeId={f.creator_id} value={f.standby_creator_ids ?? []} onChange={(ids) => set('standby_creator_ids', ids)} />
      <Field label="Observações (turno/horário)"><TextArea value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value || null)} placeholder="Ex.: Turno manhã (08h–14h)" /></Field>
    </Modal>
  );
}

function EditShiftModal({ shift, creators, onClose, onSave, onDelete }: {
  shift: Shift; creators: Creator[]; onClose: () => void; onSave: (data: NewShift) => void; onDelete: () => void;
}) {
  const [f, setF] = useState<NewShift>({
    shift_date: shift.shift_date, creator_id: shift.creator_id, status: shift.status, notes: shift.notes, standby_creator_ids: shift.standby_creator_ids,
  });
  const set = (k: keyof NewShift, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Modal open title="Editar plantão" subtitle="tabela shifts" onClose={onClose} footer={<>
      <Button variant="ghost" onClick={onDelete} style={{ color: 'var(--red)', marginRight: 'auto' }}>Excluir</Button>
      <Button variant="ghost" onClick={onClose}>Cancelar</Button>
      <Button onClick={() => onSave(f)}>Salvar</Button>
    </>}>
      <Field label="Creator (plantonista)"><Select value={f.creator_id ?? ''} onChange={(e) => set('creator_id', e.target.value || null)}>{creators.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
      <Field label="Data"><DatePicker value={f.shift_date} onChange={(v) => set('shift_date', v)} /></Field>
      <StandbyPicker creators={creators} excludeId={f.creator_id} value={f.standby_creator_ids ?? []} onChange={(ids) => set('standby_creator_ids', ids)} />
      <Field label="Observações (turno/horário)"><TextArea value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value || null)} placeholder="Ex.: Turno manhã (08h–14h)" /></Field>
    </Modal>
  );
}

function HistoryModal({ shift, onClose }: { shift: Shift; onClose: () => void }) {
  const history = useAsync<StatusHistoryEntry[]>(() => api.statusHistory.list('shift', shift.id), [shift.id]);
  const list = history.data ?? [];
  return (
    <Modal open title="Histórico do plantão" subtitle={label(shift.shift_date)} onClose={onClose} footer={<Button variant="ghost" onClick={onClose}>Fechar</Button>}>
      {list.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--tx3)' }}>Nenhuma mudança de status registrada ainda.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {list.map((h) => (
          <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 11, background: 'var(--bg2)', border: '1px solid var(--line)' }}>
            <span style={{ fontSize: 11.5 }}>{h.old_status ? SHIFT_STATUS_META[h.old_status as ShiftStatus]?.label ?? h.old_status : '—'}</span>
            <FormNext color="var(--tx3)" size="small" />
            <span style={{ fontSize: 11.5, fontWeight: 700 }}>{h.new_status ? SHIFT_STATUS_META[h.new_status as ShiftStatus]?.label ?? h.new_status : '—'}</span>
            <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--tx3)' }}>{shortDate(h.changed_at.slice(0, 10))}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
