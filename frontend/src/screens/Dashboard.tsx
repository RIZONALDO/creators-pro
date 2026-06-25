import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api';
import { useApp } from '@/context/AppContext';
import { useNotifications, useRealtimeRefresh } from '@/context/NotificationsContext';
import { useAsync } from '@/lib/useAsync';
import { Card, Avatar, Tag, StatusPill } from '@/components/ui';
import { TaskDetailScreen } from '@/components/TaskDetailScreen';
import { MobileScreen } from '@/components/MobileScreen';
import { NotificationsList } from '@/components/NotificationsList';
import { OnboardingChecklist } from '@/components/OnboardingChecklist';
import { PushPrompt } from '@/components/PushPrompt';
import { TASK_STATUS_META, SHIFT_STATUS_META, TASK_FORMAT_COLOR, shortDate } from '@/lib/display';
import { currentWeekWeekdays, todayIso } from '@/lib/dates';
import type { CreatorTask, Creator, Client, Absence, Shift, ScaleEntry, NotificationType } from '@/types';

const now = new Date();
const SCALE_MONTH = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const TASK_NOTIFICATION_TYPES: NotificationType[] = ['nova_tarefa', 'mudanca_status'];
const SHIFT_NOTIFICATION_TYPES: NotificationType[] = ['novo_plantao'];

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
  const { user } = useApp();
  return user?.role === 'operacional' ? <OperationalHome /> : <CoordinatorDashboard />;
}

function CoordinatorDashboard() {
  const tasks = useAsync<CreatorTask[]>(() => api.tasks.list(), []);
  const creators = useAsync<Creator[]>(() => api.creators.list(), []);
  const clients = useAsync<Client[]>(() => api.clients.list(), []);
  const absences = useAsync<Absence[]>(() => api.absences.list(), []);
  const schedule = useAsync<ScaleEntry[]>(() => api.schedule.list(SCALE_MONTH), []);
  const shifts = useAsync<Shift[]>(() => api.shifts.list(), []);

  const t = tasks.data ?? [];
  const cre = creators.data ?? [];
  const cli = clients.data ?? [];
  const abs = absences.data ?? [];
  const creName = (id: string | null) => cre.find((c) => c.id === id)?.name ?? '—';
  const cliName = (id: string | null) => cli.find((c) => c.id === id)?.name ?? '—';
  // mesma checagem do Schedule.tsx — sem isso, um creator com ausência aprovada continua aparecendo
  // como "trabalhando" no card da semana, já que a escala (ScaleEntry) não se auto-remove na aprovação.
  const approvedAbsences = abs.filter((a) => a.status === 'approved');
  const hasApprovedAbsenceOn = (creatorId: string, date: string) =>
    approvedAbsences.some((a) => a.creator_id === creatorId && a.start_date <= date && date <= a.end_date);

  const cnt = (s: string) => t.filter((x) => x.status === s).length;
  const today = todayIso();
  const thisMonth = today.slice(0, 7);
  const activeStatuses = ['na_fila', 'em_edicao', 'no_servidor', 'em_aprovacao', 'em_alteracao', 'falta_captacao'];
  const ativas = t.filter((x) => activeStatuses.includes(x.status)).length;
  const pend = abs.filter((a) => a.status === 'pending');

  // Tarefas com data vencida e ainda não concluídas/canceladas
  const overdue = t.filter((x) => !!x.task_date && x.task_date < today && activeStatuses.includes(x.status)).length;
  // Aprovadas no mês corrente
  const approvedThisMonth = t.filter((x) => x.status === 'aprovado' && x.task_date?.startsWith(thisMonth)).length;
  // Creators com pelo menos 1 tarefa ativa
  const creatorsInProduction = new Set(t.filter((x) => activeStatuses.includes(x.status) && x.creator_id).map((x) => x.creator_id)).size;
  // Próximos plantões (futuro, não cancelados)
  const futureShifts = (shifts.data ?? []).filter((s) => s.shift_date >= today && s.status !== 'cancelled');
  const nextWeekend = futureShifts.find((s) => [0, 6].includes(new Date(`${s.shift_date}T00:00:00`).getDay()));

  const kpis = [
    kpiCard('Tarefas em andamento', String(ativas), '#6C63FF', `${t.filter((x) => x.task_date === today && activeStatuses.includes(x.status)).length} vencem hoje`, '#9A9AB2'),
    kpiCard('Tarefas atrasadas', String(cnt('em_alteracao') + cnt('falta_captacao')), '#EF4444', `${overdue} com prazo vencido`, overdue > 0 ? '#EF4444' : '#9A9AB2'),
    kpiCard('Tarefas aprovadas', String(cnt('aprovado')), '#22C55E', `${approvedThisMonth} aprovadas este mês`, '#22C55E'),
    kpiCard('Creators ativos', String(cre.length), '#06B6D4', `${creatorsInProduction} com tarefa ativa`, '#9A9AB2'),
    kpiCard('Ausências pendentes', String(pend.length), '#F59E0B', 'Aguardando aprovação', '#F59E0B'),
    kpiCard('Plantões futuros', String(futureShifts.length), '#8B5CF6', nextWeekend ? `Próx. fim de semana: ${shortDate(nextWeekend.shift_date)}` : 'Nenhum no fim de semana', '#9A9AB2'),
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

  // Últimos 7 meses (inclusive o atual) para o gráfico de entregas
  const deliveryMonths = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (6 - i), 1);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
    const count = t.filter((x) => x.status === 'aprovado' && (x.task_date ?? '').startsWith(iso)).length;
    return { iso, label: label.charAt(0).toUpperCase() + label.slice(1), count };
  });
  const maxDelivery = Math.max(...deliveryMonths.map((m) => m.count), 1);

  const weekDays = currentWeekWeekdays();
  // Mais de 1 creator por dia é permitido na escala (Schedule.tsx) — um Map de 1 entrada por data
  // perdia os demais (sobrava só o último, meio aleatório). Agrupa todos os que caem no mesmo dia.
  const scaleByDate = new Map<string, ScaleEntry[]>();
  for (const e of schedule.data ?? []) scaleByDate.set(e.work_date, [...(scaleByDate.get(e.work_date) ?? []), e]);
  const weekendShifts = (shifts.data ?? [])
    .filter((s) => s.status !== 'cancelled' && [0, 6].includes(new Date(`${s.shift_date}T00:00:00`).getDay()))
    .sort((a, b) => a.shift_date.localeCompare(b.shift_date))
    .slice(0, 4);

  return (
    <div className="cp-fade" style={{ maxWidth: 1240, margin: '0 auto' }}>
      <OnboardingChecklist />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 14, marginBottom: 18 }}>{kpis}</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card pad={20}>
          <div style={{ fontWeight: 700, fontSize: 15, fontFamily: "'Plus Jakarta Sans'", marginBottom: 16 }}>Entregas mensais</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 172 }}>
            {deliveryMonths.map((m) => (
              <div key={m.iso} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%', justifyContent: 'flex-end' }}>
                <div style={{ fontSize: 10.5, color: 'var(--tx2)', fontWeight: 600 }}>{m.count}</div>
                <div style={{ width: '100%', borderRadius: '8px 8px 4px 4px', height: `${(m.count / maxDelivery) * 100}%`, minHeight: m.count > 0 ? 6 : 0, background: m.iso === thisMonth ? 'linear-gradient(180deg,#8B5CF6,#6C63FF)' : 'linear-gradient(180deg,rgba(139,92,246,.55),rgba(108,99,255,.35))' }} />
                <div style={{ fontSize: 10.5, color: 'var(--tx3)' }}>{m.label}</div>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, marginTop: 16 }}>
        <Card pad={20}>
          <div style={{ fontWeight: 700, fontSize: 14, fontFamily: "'Plus Jakarta Sans'", marginBottom: 14 }}>Escala da semana</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
            {weekDays.map((d) => {
              const entries = scaleByDate.get(d.iso) ?? [];
              const isHoliday = entries.some((e) => e.is_holiday);
              const dayCreators = entries.map((e) => (e.creator_id ? cre.find((x) => x.id === e.creator_id) : null)).filter((c): c is Creator => !!c);
              return (
                <div key={d.iso} style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 13, padding: 9, minHeight: 84, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--tx3)' }}>{d.label} {d.dayNum}</span>
                  {isHoliday && <span style={{ fontSize: 9.5, color: 'var(--red)', fontWeight: 600 }}>Feriado</span>}
                  {!isHoliday && dayCreators.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginTop: 'auto' }}>
                      {dayCreators.map((c) => {
                        const absent = hasApprovedAbsenceOn(c.id, d.iso);
                        // Ausente: só avatar + "Ausente" ao lado (sem nome) — se o gestor já adicionou um
                        // substituto pra esse dia (outra entrada da escala), ele aparece embaixo no
                        // formato normal (avatar + nome), nada aqui esconde ou confunde os dois.
                        return absent ? (
                          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Avatar name={c.name} size={16} seed={c.id} />
                            <span style={{ fontSize: 8.5, fontWeight: 700, color: 'var(--amber)' }}>Ausente</span>
                          </div>
                        ) : (
                          <div key={c.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                            <Avatar name={c.name} size={dayCreators.length > 1 ? 18 : 24} seed={c.id} />
                            <span style={{ fontSize: dayCreators.length > 1 ? 8.5 : 9.5, fontWeight: 600, textAlign: 'center', lineHeight: 1.15 }}>{c.name.split(' ')[0]}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {!isHoliday && dayCreators.length === 0 && <span style={{ fontSize: 9.5, color: 'var(--tx3)', marginTop: 'auto' }}>Sem creator</span>}
                </div>
              );
            })}
          </div>
        </Card>
        <Card pad={20}>
          <div style={{ fontWeight: 700, fontSize: 14, fontFamily: "'Plus Jakarta Sans'", marginBottom: 14 }}>Plantões do fim de semana</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {weekendShifts.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--tx3)' }}>Nenhum plantão de fim de semana.</div>}
            {weekendShifts.map((s) => {
              const c = s.creator_id ? cre.find((x) => x.id === s.creator_id) : null;
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 9, borderRadius: 12, background: 'var(--bg2)', border: '1px solid var(--line)' }}>
                  <Avatar name={c?.name ?? 'A designar'} size={26} seed={s.creator_id ?? ''} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c?.name ?? 'A designar'}</div>
                    <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{shortDate(s.shift_date)} · {s.notes ?? 'Plantão'}</div>
                  </div>
                  <StatusPill meta={SHIFT_STATUS_META[s.status]} />
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

/** Início do app mobile (papel operacional) — saudação, status do dia e próprias tarefas. */
function OperationalHome() {
  const { user } = useApp();
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();
  const tasks = useAsync<CreatorTask[]>(() => api.tasks.list(), []); // backend já filtra: só as próprias
  const shifts = useAsync<Shift[]>(() => api.shifts.list(), []); // idem
  // tarefa criada/status mudou e plantão novo chegam ao vivo (notification:new) — sem isso, só
  // apareciam aqui depois de recarregar a tela manualmente.
  useRealtimeRefresh(TASK_NOTIFICATION_TYPES, tasks.reload);
  useRealtimeRefresh(SHIFT_NOTIFICATION_TYPES, shifts.reload);
  // client_name vem embutido em GET /tasks (LEFT JOIN no backend) — GET /clients é bloqueado pro
  // operacional, então sem esse campo não teria como mostrar o nome do cliente aqui.
  const t = tasks.data ?? [];
  const cliName = (task: CreatorTask) => task.client_name ?? '—';
  const [detailTask, setDetailTask] = useState<CreatorTask | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);

  const today = todayIso();
  const todayCount = t.filter((x) => x.task_date === today).length;
  // GET /shifts já devolve titular OU sobreaviso (não só titular) — "Sim/—" sem data nem papel não
  // comunicava nada de útil; mostra o próximo plantão real (qualquer dia, não só fim de semana,
  // já que shifts não são exclusivamente de fds) e se é como titular ou sobreaviso.
  const nextShift = (shifts.data ?? [])
    .filter((s) => s.shift_date >= today && s.status !== 'cancelled')
    .sort((a, b) => a.shift_date.localeCompare(b.shift_date))[0] ?? null;
  const nextShiftIsStandby = !!nextShift && !!user?.creator_id && nextShift.standby_creator_ids.includes(user.creator_id) && nextShift.creator_id !== user.creator_id;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  const upcoming = t.filter((x) => ['na_fila', 'em_edicao', 'no_servidor', 'em_aprovacao'].includes(x.status)).slice(0, 4);

  return (
    <div className="cp-fade">
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 22 }}>
        <button onClick={() => navigate('/perfil')} style={{ display: 'flex', alignItems: 'center', gap: 13, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
          <Avatar name={user?.name ?? ''} size={52} imageUrl={user?.avatar_url} />
          <div style={{ lineHeight: 1.25 }}>
            <div style={{ fontSize: 13.5, color: 'var(--tx3)' }}>{greeting},</div>
            <div style={{ fontSize: 19, fontWeight: 700, fontFamily: "'Plus Jakarta Sans'" }}>{user?.name}</div>
          </div>
        </button>
        <button onClick={() => setShowNotifications(true)} style={{ marginLeft: 'auto', width: 46, height: 46, flex: 'none', borderRadius: 13, background: 'var(--bg2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="var(--tx2)" strokeWidth="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
          {unreadCount > 0 && (
            <span style={{ position: 'absolute', top: 6, right: 7, minWidth: 17, height: 17, borderRadius: 9, background: 'var(--red)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', border: '2px solid var(--bg1)' }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
          )}
        </button>
      </div>

      <PushPrompt />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 22 }}>
        <div style={{ background: 'linear-gradient(145deg,rgba(108,99,255,.2),rgba(108,99,255,.06))', border: '1px solid rgba(108,99,255,.3)', borderRadius: 18, padding: 17 }}>
          <div style={{ fontSize: 30, fontWeight: 800, fontFamily: "'Plus Jakarta Sans'" }}>{todayCount}</div>
          <div style={{ fontSize: 13, color: 'var(--tx2)' }}>tarefas hoje</div>
        </div>
        <div style={{
          background: nextShift ? (nextShiftIsStandby ? 'linear-gradient(145deg,rgba(245,158,11,.18),rgba(245,158,11,.05))' : 'linear-gradient(145deg,rgba(34,197,94,.18),rgba(34,197,94,.05))') : 'var(--bg2)',
          border: `1px solid ${nextShift ? (nextShiftIsStandby ? 'rgba(245,158,11,.28)' : 'rgba(34,197,94,.28)') : 'var(--line)'}`, borderRadius: 18, padding: 17,
        }}>
          {nextShift ? (
            <>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: nextShiftIsStandby ? 'var(--amber)' : 'var(--green)', textTransform: 'uppercase', letterSpacing: '.03em' }}>{nextShiftIsStandby ? 'Sobreaviso' : 'Plantonista'}</div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Plus Jakarta Sans'", marginTop: 2 }}>{shortDate(nextShift.shift_date)}</div>
              <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 2 }}>próximo plantão</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 30, fontWeight: 800, fontFamily: "'Plus Jakarta Sans'", color: 'var(--tx3)' }}>—</div>
              <div style={{ fontSize: 13, color: 'var(--tx2)' }}>sem plantão agendado</div>
            </>
          )}
        </div>
      </div>

      <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Plus Jakarta Sans'", marginBottom: 13 }}>Próximas tarefas</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {upcoming.length === 0 && <div style={{ fontSize: 14.5, color: 'var(--tx3)' }}>Nenhuma tarefa por aqui.</div>}
        {upcoming.map((task) => (
          <div key={task.id} onClick={() => setDetailTask(task)} style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 16, padding: 15, display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer' }}>
            <div style={{ width: 4, height: 40, borderRadius: 4, background: TASK_STATUS_META[task.status].color, flex: 'none' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</div>
              <div style={{ fontSize: 13, color: 'var(--tx3)' }}>{cliName(task)} · {shortDate(task.task_date)}</div>
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: TASK_STATUS_META[task.status].color, background: TASK_STATUS_META[task.status].bg, padding: '3px 9px', borderRadius: 7, flex: 'none' }}>{TASK_STATUS_META[task.status].label}</span>
          </div>
        ))}
      </div>

      {detailTask && <TaskDetailScreen task={detailTask} onClose={() => setDetailTask(null)} />}
      {showNotifications && <MobileScreen title="Notificações" onBack={() => setShowNotifications(false)}><NotificationsList /></MobileScreen>}
    </div>
  );
}
