import { useState } from 'react';
import { api } from '@/api';
import { useAsync } from '@/lib/useAsync';
import { Card, Avatar, Button } from '@/components/ui';
import type { ScaleEntry, Creator, Absence } from '@/types';

/** Escala: arraste um creator da paleta para um dia útil. */
export function Schedule() {
  const schedule = useAsync<ScaleEntry[]>(() => api.schedule.list('2026-06'), []);
  const creators = useAsync<Creator[]>(() => api.creators.list(), []);
  const absences = useAsync<Absence[]>(() => api.absences.list(), []);
  const [drag, setDrag] = useState<string | null>(null);

  const byDate = new Map((schedule.data ?? []).map((e) => [e.work_date, e.creator_id]));
  const cre = creators.data ?? [];
  const creById = (id: string | null) => cre.find((c) => c.id === id) ?? null;
  const approvedOut = new Set((absences.data ?? []).filter((a) => a.status === 'approved').map((a) => a.creator_id));

  // grade de junho/2026 (dias úteis seg–sex)
  const weeks = [[1, 2, 3, 4, 5], [8, 9, 10, 11, 12], [15, 16, 17, 18, 19], [22, 23, 24, 25, 26], [29, 30, null, null, null]];
  const iso = (d: number) => `2026-06-${String(d).padStart(2, '0')}`;

  async function assign(date: string) {
    if (!drag) return;
    schedule.setData((prev) => {
      const next = [...(prev ?? [])];
      const i = next.findIndex((e) => e.work_date === date);
      if (i >= 0) next[i] = { ...next[i], creator_id: drag };
      else next.push({ id: date, scale_month_id: 'sm1', creator_id: drag, work_date: date, is_holiday: false, created_at: '' });
      return next;
    });
    await api.schedule.assign(date, drag);
    setDrag(null);
  }

  const workdays = weeks.flat().filter((d): d is number => d !== null);

  /** Distribui creators nos dias úteis (round-robin), pulando ausências aprovadas. */
  async function autoFill() {
    const pool = cre.filter((c) => !approvedOut.has(c.id));
    if (!pool.length) return;
    const assignments = workdays.map((d, i) => ({ date: iso(d), creatorId: pool[i % pool.length].id }));
    schedule.setData(() => assignments.map((a) => ({ id: a.date, scale_month_id: 'sm1', creator_id: a.creatorId, work_date: a.date, is_holiday: false, created_at: '' })));
    await Promise.all(assignments.map((a) => api.schedule.assign(a.date, a.creatorId)));
  }

  function duplicateMonth() {
    autoFill();
    alert('Escala de Junho duplicada para o próximo mês (distribuição mantida).');
  }

  return (
    <div className="cp-fade">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: '7px 14px' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--tx2)" strokeWidth="2.2"><path d="M15 18l-6-6 6-6" /></svg>
          <span style={{ fontWeight: 700, fontSize: 14, fontFamily: "'Plus Jakarta Sans'" }}>Junho 2026</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--tx2)" strokeWidth="2.2"><path d="M9 18l6-6-6-6" /></svg>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 9 }}>
          <Button variant="ghost" onClick={duplicateMonth} icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 2h6v4H9z" /></svg>}>Duplicar mês</Button>
          <Button onClick={autoFill} icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" /></svg>}>Escala automática</Button>
        </div>
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
                  const c = creById(byDate.get(iso(d)) ?? null);
                  const conflict = c && approvedOut.has(c.id);
                  return (
                    <div key={di} onDragOver={(e) => e.preventDefault()} onDrop={() => assign(iso(d))}
                      style={{ minHeight: 96, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 13, padding: 9, display: 'flex', flexDirection: 'column', gap: 7 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx2)' }}>{d}</span>
                      {c && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, borderRadius: 11, opacity: conflict ? 0.55 : 1, background: conflict ? 'rgba(120,120,140,.12)' : 'rgba(108,99,255,.12)', border: `1px solid ${conflict ? 'rgba(120,120,140,.3)' : 'rgba(108,99,255,.3)'}` }}>
                          <Avatar name={c.name} size={24} seed={c.id} />
                          <span style={{ fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                        </div>
                      )}
                      {conflict && <div style={{ fontSize: 9.5, color: 'var(--amber)', fontWeight: 600 }}>Ausência aprovada</div>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div style={{ width: 230, flex: 'none' }}>
        <Card pad={16}>
          <div style={{ fontWeight: 700, fontSize: 13.5, fontFamily: "'Plus Jakarta Sans'", marginBottom: 4 }}>Creators disponíveis</div>
          <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 14, lineHeight: 1.4 }}>Arraste um creator para um dia da escala</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {cre.map((c) => (
              <div key={c.id} draggable onDragStart={() => setDrag(c.id)} onDragEnd={() => setDrag(null)}
                style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px', borderRadius: 12, background: 'rgba(108,99,255,.10)', border: '1px solid rgba(108,99,255,.27)', cursor: 'grab', userSelect: 'none' }}>
                <Avatar name={c.name} size={30} seed={c.id} />
                <div style={{ lineHeight: 1.2 }}><div style={{ fontSize: 12.5, fontWeight: 600 }}>{c.name}</div><div style={{ fontSize: 10.5, color: 'var(--tx3)' }}>{c.employment_type === 'fixed' ? 'Fixo' : 'Freelancer'}</div></div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      </div>
    </div>
  );
}
