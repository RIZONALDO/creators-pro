import { useState } from 'react';
import { api } from '@/api';
import { useAsync } from '@/lib/useAsync';
import { Card, Avatar, StatusPill, Button } from '@/components/ui';
import { Modal, Field, Select, TextInput, TextArea } from '@/components/Modal';
import { SHIFT_STATUS_META } from '@/lib/display';
import type { Shift, Creator, ShiftStatus, NewShift } from '@/types';

const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sáb'];
function label(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const wd = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return `${wd[new Date(y, m - 1, d).getDay()]} ${d}`;
}

const STATUSES: ShiftStatus[] = ['pending', 'confirmed', 'completed', 'cancelled'];

export function Shifts() {
  const shifts = useAsync<Shift[]>(() => api.shifts.list(), []);
  const creators = useAsync<Creator[]>(() => api.creators.list(), []);
  const [modal, setModal] = useState<null | { mode: 'novo' } | { mode: 'trocar'; shift: Shift }>(null);

  const cre = creators.data ?? [];
  const creName = (id: string | null) => cre.find((c) => c.id === id)?.name ?? 'A designar';

  async function create(data: NewShift) {
    const s = await api.shifts.create(data, 'u2');
    shifts.setData((p) => [s, ...(p ?? [])]);
    setModal(null);
  }

  function swap(shiftId: string, creatorId: string) {
    shifts.setData((p) => (p ?? []).map((s) => (s.id === shiftId ? { ...s, creator_id: creatorId } : s)));
    setModal(null);
  }

  return (
    <div className="cp-fade">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ fontSize: 13, color: 'var(--tx2)' }}>Plantões de fim de semana · <strong style={{ color: 'var(--tx)' }}>Junho 2026</strong></div>
        <div style={{ marginLeft: 'auto' }}>
          <Button icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>} onClick={() => setModal({ mode: 'novo' })}>Criar plantão</Button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
        {(shifts.data ?? []).map((s) => (
          <Card key={s.id} pad={17} style={{ background: 'linear-gradient(160deg,var(--bg2),var(--bg1))' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(139,92,246,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--pri2)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M1 12h2M21 12h2" /></svg>
                </div>
                <div style={{ lineHeight: 1.2 }}><div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Plus Jakarta Sans'" }}>{label(s.shift_date)}</div><div style={{ fontSize: 11, color: 'var(--tx3)' }}>{s.notes ?? 'Plantão'}</div></div>
              </div>
              <span style={{ marginLeft: 'auto' }}><StatusPill meta={SHIFT_STATUS_META[s.status]} /></span>
            </div>
            <div style={{ height: 1, background: 'var(--line)', marginBottom: 13 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar name={creName(s.creator_id)} size={30} seed={s.creator_id ?? ''} />
              <div style={{ flex: 1 }}><div style={{ fontSize: 12.5, fontWeight: 600 }}>{creName(s.creator_id)}</div><div style={{ fontSize: 11, color: 'var(--tx3)' }}>Creator de plantão</div></div>
              <button onClick={() => setModal({ mode: 'trocar', shift: s })} style={{ fontSize: 11.5, color: 'var(--pri)', background: 'rgba(108,99,255,.1)', border: '1px solid rgba(108,99,255,.25)', borderRadius: 8, padding: '5px 10px', fontWeight: 600, cursor: 'pointer' }}>Trocar</button>
            </div>
          </Card>
        ))}
      </div>

      {modal?.mode === 'novo' && <NewShiftModal creators={cre} onClose={() => setModal(null)} onCreate={create} />}
      {modal?.mode === 'trocar' && <SwapModal shift={modal.shift} creators={cre} current={creName(modal.shift.creator_id)} onClose={() => setModal(null)} onSwap={(cid) => swap(modal.shift.id, cid)} />}
    </div>
  );
}

function NewShiftModal({ creators, onClose, onCreate }: { creators: Creator[]; onClose: () => void; onCreate: (d: NewShift) => void }) {
  const [f, setF] = useState<NewShift>({ shift_date: '2026-06-28', creator_id: creators[0]?.id ?? null, status: 'pending', notes: 'Turno manhã (08h–14h)' });
  const set = (k: keyof NewShift, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Modal open title="Novo plantão" subtitle="tabela shifts" onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={() => onCreate(f)}>Criar plantão</Button></>}>
      <Field label="Creator"><Select value={f.creator_id ?? ''} onChange={(e) => set('creator_id', e.target.value || null)}>{creators.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Data"><TextInput type="date" value={f.shift_date} onChange={(e) => set('shift_date', e.target.value)} /></Field>
        <Field label="Status"><Select value={f.status} onChange={(e) => set('status', e.target.value as ShiftStatus)}>{STATUSES.map((s) => <option key={s} value={s}>{SHIFT_STATUS_META[s].label}</option>)}</Select></Field>
      </div>
      <Field label="Observações (turno/horário)"><TextArea value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value || null)} placeholder="Ex.: Turno manhã (08h–14h)" /></Field>
    </Modal>
  );
}

function SwapModal({ shift, creators, current, onClose, onSwap }: { shift: Shift; creators: Creator[]; current: string; onClose: () => void; onSwap: (creatorId: string) => void }) {
  const [cid, setCid] = useState(shift.creator_id ?? creators[0]?.id ?? '');
  return (
    <Modal open title="Trocar plantonista" subtitle="shifts.creator_id" onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={() => cid && onSwap(cid)}>Confirmar troca</Button></>}>
      <Field label="Plantonista atual"><TextInput value={current} readOnly style={{ opacity: 0.7 }} /></Field>
      <Field label="Novo plantonista"><Select value={cid} onChange={(e) => setCid(e.target.value)}>{creators.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
    </Modal>
  );
}
