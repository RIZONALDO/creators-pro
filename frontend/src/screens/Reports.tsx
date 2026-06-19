import { api } from '@/api';
import { useAsync } from '@/lib/useAsync';
import { Card, Avatar, StatusPill, Button } from '@/components/ui';
import { TASK_STATUS_META, shortDate } from '@/lib/display';
import type { CreatorTask, Creator, Client } from '@/types';

export function Reports() {
  const tasks = useAsync<CreatorTask[]>(() => api.tasks.list(), []);
  const creators = useAsync<Creator[]>(() => api.creators.list(), []);
  const clients = useAsync<Client[]>(() => api.clients.list(), []);
  const t = tasks.data ?? [];
  const creName = (id: string | null) => creators.data?.find((c) => c.id === id)?.name ?? '—';
  const cliName = (id: string | null) => clients.data?.find((c) => c.id === id)?.name ?? '—';

  const kpis = [
    { label: 'Produção mensal', value: '48', sub: 'tarefas em junho', color: 'var(--pri)' },
    { label: 'Entregas aprovadas', value: String(t.filter((x) => x.status === 'aprovado').length), sub: 'taxa 86%', color: 'var(--green)' },
    { label: 'Plantões realizados', value: '12', sub: 'no trimestre', color: 'var(--pri2)' },
    { label: 'Ausências', value: '5', sub: '2 pendentes', color: 'var(--amber)' },
  ];

  // produção por cliente
  const byClient = (clients.data ?? []).map((c) => ({ name: c.name, n: t.filter((x) => x.client_id === c.id).length })).sort((a, b) => b.n - a.n);
  const max = Math.max(1, ...byClient.map((c) => c.n));

  const exportBtn = (label: string, color: string) => (
    <Button variant="ghost" icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>}>{label}</Button>
  );

  return (
    <div className="cp-fade" style={{ maxWidth: 1240, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 11, padding: '8px 13px', fontSize: 12.5, color: 'var(--tx2)' }}>Período: <strong style={{ color: 'var(--tx)' }}>Junho 2026</strong></div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 9 }}>{exportBtn('PDF', '#EF4444')}{exportBtn('Excel', '#22C55E')}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 16 }}>
        {kpis.map((k) => (
          <Card key={k.label} pad={18} style={{ background: 'linear-gradient(160deg,var(--bg2),var(--bg1))' }}>
            <div style={{ fontSize: 12, color: 'var(--tx2)' }}>{k.label}</div>
            <div style={{ fontSize: 30, fontWeight: 800, fontFamily: "'Plus Jakarta Sans'", margin: '6px 0 2px', color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 11.5, color: 'var(--tx3)' }}>{k.sub}</div>
          </Card>
        ))}
      </div>

      <Card pad={20} style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15, fontFamily: "'Plus Jakarta Sans'", marginBottom: 16 }}>Produção por cliente</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          {byClient.map((c) => (
            <div key={c.name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}><span style={{ color: 'var(--tx2)' }}>{c.name}</span><span style={{ fontWeight: 700 }}>{c.n}</span></div>
              <div style={{ height: 8, borderRadius: 6, background: 'var(--bg3)', overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: 6, width: `${(c.n / max) * 100}%`, background: 'linear-gradient(90deg,#6C63FF,#8B5CF6)' }} /></div>
            </div>
          ))}
        </div>
      </Card>

      <Card pad={0} style={{ overflow: 'hidden' }}>
        <div style={{ padding: '15px 20px', borderBottom: '1px solid var(--line)', fontWeight: 700, fontSize: 14, fontFamily: "'Plus Jakarta Sans'" }}>Detalhamento de entregas</div>
        <div style={{ display: 'grid', gridTemplateColumns: '2.4fr 1.4fr 1.4fr 1.3fr 90px', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--line)', fontSize: 11, fontWeight: 700, letterSpacing: '.04em', color: 'var(--tx3)' }}>
          <span>TAREFA</span><span>CLIENTE</span><span>CREATOR</span><span>STATUS</span><span>DATA</span>
        </div>
        {t.slice(0, 8).map((task) => (
          <div key={task.id} style={{ display: 'grid', gridTemplateColumns: '2.4fr 1.4fr 1.4fr 1.3fr 90px', gap: 12, padding: '13px 20px', borderBottom: '1px solid var(--line)', alignItems: 'center', fontSize: 12.5 }}>
            <span style={{ fontWeight: 600 }}>{task.title}</span>
            <span style={{ color: 'var(--tx2)' }}>{cliName(task.client_id)}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Avatar name={creName(task.creator_id)} size={22} seed={task.creator_id ?? ''} /><span style={{ color: 'var(--tx2)' }}>{creName(task.creator_id)}</span></span>
            <span><StatusPill meta={TASK_STATUS_META[task.status]} /></span>
            <span style={{ color: 'var(--tx3)' }}>{shortDate(task.task_date)}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
