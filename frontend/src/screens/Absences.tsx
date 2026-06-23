import { useState } from 'react';
import { api } from '@/api';
import { useApp } from '@/context/AppContext';
import { useAsync } from '@/lib/useAsync';
import { Card, Avatar, StatusPill, Button } from '@/components/ui';
import { Modal, TextArea } from '@/components/Modal';
import { DatePicker } from '@/components/DatePicker';
import { MobileField, MOBILE_INPUT_STYLE } from '@/components/MobileField';
import { MobileScreen, DetailRow } from '@/components/MobileScreen';
import { AttachmentUpload } from '@/components/AttachmentUpload';
import { ABSENCE_STATUS_META, shortDate } from '@/lib/display';
import { useToast } from '@/context/ToastContext';
import { useRealtimeRefresh } from '@/context/NotificationsContext';
import { useCan } from '@/lib/permissions';
import type { Absence, Creator, NewAbsence, NotificationType } from '@/types';

const ABSENCE_NOTIFICATION_TYPES: NotificationType[] = ['ausencia_aprovada', 'ausencia_rejeitada'];

export function Absences() {
  // admin/gestor aprovam/rejeitam ausências de todo mundo; operacional só solicita e acompanha as próprias.
  return useCan('absences-review') ? <AbsencesReview /> : <MyAbsences />;
}

function AbsencesReview() {
  const { user } = useApp();
  const toast = useToast();
  const absences = useAsync<Absence[]>(() => api.absences.list(), []);
  const creators = useAsync<Creator[]>(() => api.creators.list(), []);
  const list = absences.data ?? [];
  const creName = (id: string) => creators.data?.find((c) => c.id === id)?.name ?? '—';
  const [attachmentsFor, setAttachmentsFor] = useState<Absence | null>(null);

  async function review(id: string, status: 'approved' | 'rejected') {
    absences.setData((prev) => (prev ?? []).map((a) => (a.id === id ? { ...a, status } : a)));
    await api.absences.review(id, status, user!.id);
    toast.success(status === 'approved' ? 'Ausência aprovada' : 'Ausência rejeitada', `${creName(list.find((a) => a.id === id)?.creator_id ?? '')}.`);
  }

  return (
    <div className="cp-fade">
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 16, fontSize: 12.5, color: 'var(--tx2)', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 11, padding: '10px 14px' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--tx3)" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
        Creators solicitam ausências pelo app. Aqui o gestor apenas <strong style={{ color: 'var(--tx)' }}>aprova ou rejeita</strong>.
      </div>

      <Card pad={0} style={{ overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.2fr 1.4fr 1fr 190px', gap: 14, padding: '14px 20px', borderBottom: '1px solid var(--line)', fontSize: 11, fontWeight: 700, letterSpacing: '.04em', color: 'var(--tx3)' }}>
          <span>COLABORADOR</span><span>PERÍODO</span><span>MOTIVO</span><span>STATUS</span><span style={{ textAlign: 'right' }}>AÇÕES</span>
        </div>
        {list.map((a) => (
          <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.2fr 1.4fr 1fr 190px', gap: 14, padding: '15px 20px', borderBottom: '1px solid var(--line)', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}><Avatar name={creName(a.creator_id)} size={34} seed={a.creator_id} /><span style={{ fontSize: 13, fontWeight: 600 }}>{creName(a.creator_id)}</span></div>
            <div style={{ fontSize: 12.5, color: 'var(--tx2)' }}>{shortDate(a.start_date)} – {shortDate(a.end_date)}</div>
            <div style={{ lineHeight: 1.3 }}><div style={{ fontSize: 12.5 }}>{a.reason ?? '—'}</div></div>
            <div><StatusPill meta={ABSENCE_STATUS_META[a.status]} /></div>
            <div style={{ display: 'flex', gap: 7, justifyContent: 'flex-end' }}>
              <button onClick={() => setAttachmentsFor(a)} title="Anexos" style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--line)', color: 'var(--tx2)', cursor: 'pointer' }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ margin: '0 auto' }}><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg></button>
              {a.status === 'pending' && (
                <>
                  <button onClick={() => review(a.id, 'approved')} title="Aprovar" style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(34,197,94,.14)', border: '1px solid rgba(34,197,94,.3)', color: '#22C55E', cursor: 'pointer' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M20 6L9 17l-5-5" /></svg></button>
                  <button onClick={() => review(a.id, 'rejected')} title="Rejeitar" style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(239,68,68,.14)', border: '1px solid rgba(239,68,68,.3)', color: '#EF4444', cursor: 'pointer' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M18 6L6 18M6 6l12 12" /></svg></button>
                </>
              )}
            </div>
          </div>
        ))}
      </Card>

      <Modal open={attachmentsFor !== null} title="Anexos da ausência" subtitle={attachmentsFor ? creName(attachmentsFor.creator_id) : ''} onClose={() => setAttachmentsFor(null)}>
        {attachmentsFor && <AttachmentUpload entityType="absence" entityId={attachmentsFor.id} />}
      </Modal>
    </div>
  );
}

const EMPTY_FORM: NewAbsence = { start_date: '', end_date: '', reason: '' };

/** view do operacional — só vê e cria as próprias (o backend já filtra/resolve pelo token). */
function MyAbsences() {
  const toast = useToast();
  const absences = useAsync<Absence[]>(() => api.absences.list(), []);
  // aprovação/rejeição chega ao vivo (notification:new) — sem isso só refletia depois de recarregar.
  useRealtimeRefresh(ABSENCE_NOTIFICATION_TYPES, absences.reload);
  const [modal, setModal] = useState(false);
  const [detail, setDetail] = useState<Absence | null>(null);
  const list = absences.data ?? [];

  async function submit(form: NewAbsence) {
    try {
      const created = await api.absences.request(form);
      absences.setData((p) => [created, ...(p ?? [])]);
      setModal(false);
      toast.success('Solicitação enviada', 'Aguarde a aprovação do gestor.');
    } catch (err) {
      toast.error('Não foi possível enviar', err instanceof Error ? err.message : 'Tente novamente.');
    }
  }

  return (
    <div className="cp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <button onClick={() => setModal(true)} style={{ background: 'linear-gradient(135deg,var(--pri),var(--pri2))', border: 'none', borderRadius: 18, padding: 17, display: 'flex', alignItems: 'center', gap: 13, boxShadow: '0 10px 24px rgba(108,99,255,.35)', cursor: 'pointer', textAlign: 'left' }}>
        <div style={{ width: 46, height: 46, flex: 'none', borderRadius: 13, background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Solicitar ausência</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.8)' }}>Data, motivo e observação</div>
        </div>
      </button>

      <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Plus Jakarta Sans'", marginTop: 5 }}>Minhas solicitações</div>
      {list.length === 0 && <div style={{ fontSize: 14.5, color: 'var(--tx3)' }}>Nenhuma solicitação ainda.</div>}
      {list.map((a) => (
        <div key={a.id} onClick={() => setDetail(a)} style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 16, padding: 16, opacity: a.status === 'rejected' ? 0.7 : 1, cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 9 }}>
            <span style={{ fontSize: 14.5, fontWeight: 600 }}>{shortDate(a.start_date)} – {shortDate(a.end_date)}</span>
            <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 700, color: ABSENCE_STATUS_META[a.status].color, background: ABSENCE_STATUS_META[a.status].bg, padding: '4px 10px', borderRadius: 8 }}>{ABSENCE_STATUS_META[a.status].label}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--tx3)' }}>{a.reason ?? '—'}</div>
        </div>
      ))}

      {modal && <RequestAbsenceScreen onClose={() => setModal(false)} onSubmit={submit} />}
      {detail && <AbsenceDetailScreen absence={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

/** Detalhes de uma solicitação de ausência própria (app mobile). */
function AbsenceDetailScreen({ absence, onClose }: { absence: Absence; onClose: () => void }) {
  return (
    <MobileScreen title="Detalhes da ausência" onBack={onClose}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: ABSENCE_STATUS_META[absence.status].color, background: ABSENCE_STATUS_META[absence.status].bg, padding: '4px 11px', borderRadius: 8 }}>{ABSENCE_STATUS_META[absence.status].label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Plus Jakarta Sans'", marginBottom: 18 }}>{shortDate(absence.start_date)} – {shortDate(absence.end_date)}</div>
      <DetailRow label="Motivo" value={absence.reason ?? '—'} />
      <DetailRow label="Solicitada em" value={shortDate(absence.created_at.slice(0, 10))} />
      {absence.status !== 'pending' && absence.approved_at && (
        <DetailRow label={absence.status === 'approved' ? 'Aprovada em' : 'Rejeitada em'} value={shortDate(absence.approved_at.slice(0, 10))} />
      )}
      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx2)', marginBottom: 8 }}>Anexos</div>
        <AttachmentUpload entityType="absence" entityId={absence.id} />
      </div>
    </MobileScreen>
  );
}

/**
 * Usa o mesmo DatePicker customizado das telas desktop: o <input type="date"> nativo testado
 * aqui não mostrava placeholder (ficava parecendo dois campos vazios sem indicação) e o texto
 * saía pequeno — o DatePicker já resolve os dois problemas.
 */
function RequestAbsenceScreen({ onClose, onSubmit }: { onClose: () => void; onSubmit: (d: NewAbsence) => void }) {
  const [form, setForm] = useState<NewAbsence>(EMPTY_FORM);
  const set = (k: keyof NewAbsence, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <MobileScreen title="Solicitar ausência" onBack={onClose}>
      <MobileField label="Data inicial"><DatePicker large value={form.start_date || null} onChange={(v) => set('start_date', v)} /></MobileField>
      <MobileField label="Data final"><DatePicker large value={form.end_date || null} onChange={(v) => set('end_date', v)} /></MobileField>
      <MobileField label="Motivo">
        <TextArea value={form.reason ?? ''} onChange={(e) => set('reason', e.target.value)} placeholder="Ex.: Consulta médica" style={{ ...MOBILE_INPUT_STYLE, minHeight: 130 }} />
      </MobileField>
      <Button style={{ width: '100%', justifyContent: 'center', fontSize: 16, padding: '15px 18px', marginTop: 8 }} onClick={() => form.start_date && form.end_date && onSubmit(form)}>Enviar solicitação</Button>
    </MobileScreen>
  );
}
