import { useState } from 'react';
import { api } from '@/api';
import { useAsync } from '@/lib/useAsync';
import { Card, Avatar, Tag, StatusPill, Button } from '@/components/ui';
import { Modal, Field, TextInput, TextArea, Select } from '@/components/Modal';
import { TASK_STATUS_META, TASK_STATUS_ORDER, TASK_FORMAT_COLOR, shortDate } from '@/lib/display';
import { useApp } from '@/context/AppContext';
import type { CreatorTask, Creator, Client, TaskStatus, TaskFormat, NewTask } from '@/types';

type View = 'kanban' | 'tabela' | 'cards' | 'timeline';
const FORMATS: TaskFormat[] = ['Story', 'Reels', 'Story/Reels', 'Select', 'Edição', 'Sonora', 'Banco', 'Aftermovie', 'Captação', 'Roteiro'];

export function Tasks() {
  const { user } = useApp();
  const tasks = useAsync<CreatorTask[]>(() => api.tasks.list(), []);
  const creators = useAsync<Creator[]>(() => api.creators.list(), []);
  const clients = useAsync<Client[]>(() => api.clients.list(), []);
  const [view, setView] = useState<View>('kanban');
  const [dragId, setDragId] = useState<string | null>(null);
  const [modal, setModal] = useState(false);

  const t = tasks.data ?? [];
  const cre = creators.data ?? [];
  const cli = clients.data ?? [];
  const creName = (id: string | null) => cre.find((c) => c.id === id)?.name ?? '—';
  const cliName = (id: string | null) => cli.find((c) => c.id === id)?.name ?? '—';

  async function moveTo(status: TaskStatus) {
    if (!dragId) return;
    tasks.setData((prev) => (prev ?? []).map((x) => (x.id === dragId ? { ...x, status } : x)));
    await api.tasks.setStatus(dragId, status);
    setDragId(null);
  }

  return (
    <div className="cp-fade">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: 4, gap: 2 }}>
          {(['kanban', 'tabela', 'cards', 'timeline'] as View[]).map((v) => (
            <button key={v} onClick={() => setView(v)} style={{ padding: '7px 13px', borderRadius: 9, border: 'none', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize', background: view === v ? 'linear-gradient(135deg,var(--pri),var(--pri2))' : 'transparent', color: view === v ? '#fff' : 'var(--tx2)' }}>{v}</button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12.5, color: 'var(--tx3)' }}>{t.length} tarefas</span>
          <Button icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>} onClick={() => setModal(true)}>Nova tarefa</Button>
        </div>
      </div>

      {view === 'kanban' && (
        <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 14, minHeight: '60vh' }}>
          {TASK_STATUS_ORDER.map((status) => {
            const col = t.filter((x) => x.status === status);
            const meta = TASK_STATUS_META[status];
            return (
              <div key={status} onDragOver={(e) => e.preventDefault()} onDrop={() => moveTo(status)} style={{ width: 286, flex: 'none', display: 'flex', flexDirection: 'column', gap: 11, background: 'var(--bg1)', border: '1px solid var(--line)', borderRadius: 18, padding: 13 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 4px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 3, background: meta.color }} />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{meta.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--tx3)', background: 'var(--bg3)', borderRadius: 6, padding: '1px 7px', fontWeight: 600 }}>{col.length}</span>
                </div>
                {col.map((task) => (
                  <div key={task.id} draggable onDragStart={() => setDragId(task.id)} onDragEnd={() => setDragId(null)} style={{ background: 'linear-gradient(160deg,var(--bg3),var(--bg2))', border: '1px solid var(--line)', borderRadius: 14, padding: 13, cursor: 'grab' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9 }}>
                      {task.format_type && <Tag label={task.format_type} color={TASK_FORMAT_COLOR[task.format_type]} />}
                      <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--tx3)' }}>{shortDate(task.task_date)}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35, marginBottom: 10 }}>{task.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar name={creName(task.creator_id)} size={24} seed={task.creator_id ?? ''} />
                      <span style={{ fontSize: 11.5, color: 'var(--tx2)' }}>{creName(task.creator_id)}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--tx3)' }}>{cliName(task.client_id)}</span>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {view === 'tabela' && (
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2.4fr 1fr 1.4fr 1.4fr 1.3fr 90px', gap: 12, padding: '13px 18px', borderBottom: '1px solid var(--line)', fontSize: 11, fontWeight: 700, letterSpacing: '.04em', color: 'var(--tx3)' }}>
            <span>TAREFA</span><span>FORMATO</span><span>CLIENTE</span><span>CREATOR</span><span>STATUS</span><span>DATA</span>
          </div>
          {t.map((task) => (
            <div key={task.id} style={{ display: 'grid', gridTemplateColumns: '2.4fr 1fr 1.4fr 1.4fr 1.3fr 90px', gap: 12, padding: '13px 18px', borderBottom: '1px solid var(--line)', alignItems: 'center', fontSize: 12.5 }}>
              <span style={{ fontWeight: 600 }}>{task.title}</span>
              <span>{task.format_type && <Tag label={task.format_type} color={TASK_FORMAT_COLOR[task.format_type]} />}</span>
              <span style={{ color: 'var(--tx2)' }}>{cliName(task.client_id)}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Avatar name={creName(task.creator_id)} size={22} seed={task.creator_id ?? ''} /><span style={{ color: 'var(--tx2)' }}>{creName(task.creator_id)}</span></span>
              <span><StatusPill meta={TASK_STATUS_META[task.status]} /></span>
              <span style={{ color: 'var(--tx3)' }}>{shortDate(task.task_date)}</span>
            </div>
          ))}
        </Card>
      )}

      {view === 'cards' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
          {t.map((task) => (
            <Card key={task.id} pad={16} style={{ background: 'linear-gradient(160deg,var(--bg2),var(--bg1))' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
                {task.format_type && <Tag label={task.format_type} color={TASK_FORMAT_COLOR[task.format_type]} />}
                <span style={{ marginLeft: 'auto' }}><StatusPill meta={TASK_STATUS_META[task.status]} /></span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, marginBottom: 14 }}>{task.title}</div>
              <div style={{ height: 1, background: 'var(--line)', marginBottom: 13 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Avatar name={creName(task.creator_id)} size={26} seed={task.creator_id ?? ''} />
                <span style={{ fontSize: 12, color: 'var(--tx2)' }}>{creName(task.creator_id)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--tx3)' }}><span>{cliName(task.client_id)}</span><span>{shortDate(task.task_date)}</span></div>
            </Card>
          ))}
        </div>
      )}

      {view === 'timeline' && (
        <Card pad={0} style={{ padding: '8px 22px' }}>
          {Object.entries(t.reduce<Record<string, CreatorTask[]>>((acc, task) => { const k = task.task_date ?? '—'; (acc[k] = acc[k] || []).push(task); return acc; }, {}))
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, group], gi, arr) => (
              <div key={date} style={{ display: 'flex', gap: 18, padding: '16px 0', borderBottom: gi === arr.length - 1 ? 'none' : '1px solid var(--line)' }}>
                <div style={{ width: 74, flex: 'none', textAlign: 'right', paddingTop: 2 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Plus Jakarta Sans'", lineHeight: 1 }}>{shortDate(date).split(' ')[0]}</div>
                  <div style={{ fontSize: 11, color: 'var(--tx3)', fontWeight: 600 }}>{shortDate(date).split(' ')[1]}</div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9, borderLeft: '2px solid var(--line)', paddingLeft: 18 }}>
                  {group.map((task) => (
                    <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 13, padding: '11px 14px' }}>
                      {task.format_type && <Tag label={task.format_type} color={TASK_FORMAT_COLOR[task.format_type]} />}
                      <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{task.title}</span>
                      <span style={{ fontSize: 11.5, color: 'var(--tx3)' }}>{cliName(task.client_id)}</span>
                      <Avatar name={creName(task.creator_id)} size={24} seed={task.creator_id ?? ''} />
                      <StatusPill meta={TASK_STATUS_META[task.status]} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </Card>
      )}

      <NewTaskModal open={modal} onClose={() => setModal(false)} creators={cre} clients={cli}
        onCreate={async (data) => { const created = await api.tasks.create(data, user!.id); tasks.setData((p) => [...(p ?? []), created]); setModal(false); }} />
    </div>
  );
}

function NewTaskModal({ open, onClose, creators, clients, onCreate }: {
  open: boolean; onClose: () => void; creators: Creator[]; clients: Client[]; onCreate: (d: NewTask) => void;
}) {
  const [form, setForm] = useState<NewTask>({ title: '', format_type: 'Story', task_date: '2026-06-18', creator_id: null, client_id: null, status: 'na_fila', description: null });
  const set = (k: keyof NewTask, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal open={open} title="Nova tarefa" subtitle="Demanda para creator" onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={() => form.title && onCreate(form)}>Criar tarefa</Button></>}>
      <Field label="Título da tarefa"><TextInput value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Ex.: Reels institucional Q2" /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Formato"><Select value={form.format_type ?? ''} onChange={(e) => set('format_type', e.target.value)}>{FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}</Select></Field>
        <Field label="Data"><TextInput type="date" value={form.task_date ?? ''} onChange={(e) => set('task_date', e.target.value)} /></Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Creator responsável"><Select value={form.creator_id ?? ''} onChange={(e) => set('creator_id', e.target.value || null)}><option value="">—</option>{creators.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field label="Cliente"><Select value={form.client_id ?? ''} onChange={(e) => set('client_id', e.target.value || null)}><option value="">—</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
      </div>
      <Field label="Descrição"><TextArea value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} placeholder="Detalhes da demanda…" /></Field>
    </Modal>
  );
}
