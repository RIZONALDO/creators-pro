import { api } from '@/api';
import { useAsync } from '@/lib/useAsync';
import { Card, Avatar, Tag } from '@/components/ui';
import { TASK_STATUS_META, TASK_FORMAT_COLOR, shortDate } from '@/lib/display';
import type { CreatorTask, Creator, Client, Absence } from '@/types';

function kpiCard(label: string, value: string, color: string, trend: string, trendColor: string) {
  return (
    <Card key={label} pad={16} style={{ background: 'linear-gradient(160deg,var(--bg2),var(--bg1))' }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: `${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, marginBottom: 12 }}>
        <span style={{ width: 12, height: 12, borderRadius: 4, background: color, display: 'block' }} />
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, fontFamily: "'Plus Jakarta Sans'", letterSpacing: '-.02em' }}>{value}</div>
      <div style={{ fontSize: 11.5, color: 'var(--tx2)', marginTop: 2, lineHeight: 1.25 }}>{label}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: trendColor, marginTop: 7 }}>{trend}</div>
    </Card>
  );
}

export function Dashboard() {
  const tasks = useAsync<CreatorTask[]>(() => api.tasks.list(), []);
  const creators = useAsync<Creator[]>(() => api.creators.list(), []);
  const clients = useAsync<Client[]>(() => api.clients.list(), []);
  const absences = useAsync<Absence[]>(() => api.absences.list(), []);

  const t = tasks.data ?? [];
  const cre = creators.data ?? [];
  const cli = clients.data ?? [];
  const abs = absences.data ?? [];
  const creName = (id: string | null) => cre.find((c) => c.id === id)?.name ?? '—';
  const cliName = (id: string | null) => cli.find((c) => c.id === id)?.name ?? '—';

  const cnt = (s: string) => t.filter((x) => x.status === s).length;
  const ativas = t.filter((x) => ['na_fila', 'em_edicao', 'no_servidor', 'em_aprovacao', 'em_alteracao', 'falta_captacao'].includes(x.status)).length;
  const pend = abs.filter((a) => a.status === 'pending');

  const kpis = [
    kpiCard('Tarefas em andamento', String(ativas), '#6C63FF', '▲ 12% vs. semana', '#22C55E'),
    kpiCard('Tarefas atrasadas', String(cnt('em_alteracao') + cnt('falta_captacao')), '#EF4444', '▲ 2 hoje', '#EF4444'),
    kpiCard('Tarefas aprovadas', String(cnt('aprovado')), '#22C55E', '▲ 8% no mês', '#22C55E'),
    kpiCard('Creators ativos', String(cre.length), '#06B6D4', '2 em produção', '#9A9AB2'),
    kpiCard('Ausências pendentes', String(pend.length), '#F59E0B', 'Aguardando você', '#F59E0B'),
    kpiCard('Plantões futuros', '5', '#8B5CF6', 'Próximo fim de semana', '#9A9AB2'),
  ];

  // distribuição p/ donut
  const seg = [
    { label: 'Aprovado', value: cnt('aprovado'), color: '#22C55E' },
    { label: 'Em produção', value: cnt('em_edicao') + cnt('no_servidor'), color: '#8B5CF6' },
    { label: 'Em aprovação', value: cnt('em_aprovacao'), color: '#F59E0B' },
    { label: 'Outros', value: cnt('na_fila') + cnt('falta_captacao') + cnt('em_alteracao') + cnt('reprovado') + cnt('cancelado'), color: '#06B6D4' },
  ];
  const total = seg.reduce((a, b) => a + b.value, 0) || 1;
  let acc = 0;
  const stops = seg.map((s) => { const from = (acc / total) * 360; acc += s.value; return `${s.color} ${from}deg ${(acc / total) * 360}deg`; });

  const upcoming = t.filter((x) => ['na_fila', 'em_edicao', 'no_servidor', 'em_aprovacao'].includes(x.status)).slice(0, 4);

  return (
    <div className="cp-fade" style={{ maxWidth: 1240, margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 14, marginBottom: 18 }}>{kpis}</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card pad={20}>
          <div style={{ fontWeight: 700, fontSize: 15, fontFamily: "'Plus Jakarta Sans'", marginBottom: 16 }}>Entregas mensais</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 172 }}>
            {[{ l: 'Jan', v: 42 }, { l: 'Fev', v: 38 }, { l: 'Mar', v: 55 }, { l: 'Abr', v: 61 }, { l: 'Mai', v: 73 }, { l: 'Jun', v: 48 }, { l: 'Jul', v: 30 }].map((b) => (
              <div key={b.l} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%', justifyContent: 'flex-end' }}>
                <div style={{ fontSize: 10.5, color: 'var(--tx2)', fontWeight: 600 }}>{b.v}</div>
                <div style={{ width: '100%', borderRadius: '8px 8px 4px 4px', height: `${(b.v / 73) * 100}%`, background: b.l === 'Jun' ? 'linear-gradient(180deg,#8B5CF6,#6C63FF)' : 'linear-gradient(180deg,rgba(139,92,246,.55),rgba(108,99,255,.35))' }} />
                <div style={{ fontSize: 10.5, color: 'var(--tx3)' }}>{b.l}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card pad={20}>
          <div style={{ fontWeight: 700, fontSize: 15, fontFamily: "'Plus Jakarta Sans'", marginBottom: 14 }}>Status das tarefas</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ width: 118, height: 118, borderRadius: '50%', flex: 'none', background: `conic-gradient(${stops.join(',')})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--bg1)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Plus Jakarta Sans'" }}>{t.length}</div>
                <div style={{ fontSize: 10, color: 'var(--tx3)' }}>total</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 1 }}>
              {seg.map((s) => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color }} />
                  <span style={{ color: 'var(--tx2)', flex: 1 }}>{s.label}</span>
                  <span style={{ fontWeight: 700 }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        <Card pad={20}>
          <div style={{ fontWeight: 700, fontSize: 14, fontFamily: "'Plus Jakarta Sans'", marginBottom: 14 }}>Próximas tarefas</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {upcoming.map((task) => (
              <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: 9, borderRadius: 12, background: 'var(--bg2)', border: '1px solid var(--line)' }}>
                <div style={{ width: 3, height: 30, borderRadius: 3, background: TASK_STATUS_META[task.status].color, flex: 'none' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{cliName(task.client_id)} · {shortDate(task.task_date)}</div>
                </div>
                {task.format_type && <Tag label={task.format_type} color={TASK_FORMAT_COLOR[task.format_type]} />}
                <Avatar name={creName(task.creator_id)} size={26} seed={task.creator_id ?? ''} />
              </div>
            ))}
          </div>
        </Card>
        <Card pad={20}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14, fontFamily: "'Plus Jakarta Sans'" }}>Ausências pendentes</div>
            <span style={{ marginLeft: 'auto', fontSize: 11, background: 'rgba(245,158,11,.16)', color: 'var(--amber)', fontWeight: 700, padding: '2px 8px', borderRadius: 7 }}>{pend.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {pend.slice(0, 3).map((a) => (
              <div key={a.id} style={{ padding: 10, borderRadius: 12, background: 'var(--bg2)', border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <Avatar name={creName(a.creator_id)} size={24} seed={a.creator_id} />
                  <div style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>{creName(a.creator_id)}</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 7 }}>{shortDate(a.start_date)} – {shortDate(a.end_date)} · {a.reason}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
