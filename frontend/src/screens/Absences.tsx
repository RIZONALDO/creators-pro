import { api } from '@/api';
import { useApp } from '@/context/AppContext';
import { useAsync } from '@/lib/useAsync';
import { Card, Avatar, StatusPill } from '@/components/ui';
import { ABSENCE_STATUS_META, shortDate } from '@/lib/display';
import type { Absence, Creator } from '@/types';

export function Absences() {
  const { user } = useApp();
  const absences = useAsync<Absence[]>(() => api.absences.list(), []);
  const creators = useAsync<Creator[]>(() => api.creators.list(), []);
  const list = absences.data ?? [];
  const creName = (id: string) => creators.data?.find((c) => c.id === id)?.name ?? '—';

  async function review(id: string, status: 'approved' | 'rejected') {
    absences.setData((prev) => (prev ?? []).map((a) => (a.id === id ? { ...a, status } : a)));
    await api.absences.review(id, status, user!.id);
  }

  return (
    <div className="cp-fade">
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 16, fontSize: 12.5, color: 'var(--tx2)', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 11, padding: '10px 14px' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--tx3)" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
        Creators solicitam ausências pelo app. Aqui o coordenador apenas <strong style={{ color: 'var(--tx)' }}>aprova ou rejeita</strong>.
      </div>

      <Card pad={0} style={{ overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.2fr 1.4fr 1fr 150px', gap: 14, padding: '14px 20px', borderBottom: '1px solid var(--line)', fontSize: 11, fontWeight: 700, letterSpacing: '.04em', color: 'var(--tx3)' }}>
          <span>COLABORADOR</span><span>PERÍODO</span><span>MOTIVO</span><span>STATUS</span><span style={{ textAlign: 'right' }}>AÇÕES</span>
        </div>
        {list.map((a) => (
          <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.2fr 1.4fr 1fr 150px', gap: 14, padding: '15px 20px', borderBottom: '1px solid var(--line)', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}><Avatar name={creName(a.creator_id)} size={34} seed={a.creator_id} /><span style={{ fontSize: 13, fontWeight: 600 }}>{creName(a.creator_id)}</span></div>
            <div style={{ fontSize: 12.5, color: 'var(--tx2)' }}>{shortDate(a.start_date)} – {shortDate(a.end_date)}</div>
            <div style={{ lineHeight: 1.3 }}><div style={{ fontSize: 12.5 }}>{a.reason ?? '—'}</div></div>
            <div><StatusPill meta={ABSENCE_STATUS_META[a.status]} /></div>
            <div style={{ display: 'flex', gap: 7, justifyContent: 'flex-end' }}>
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
    </div>
  );
}
