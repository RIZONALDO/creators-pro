import { useState } from 'react';
import { api } from '@/api';
import { useAsync } from '@/lib/useAsync';
import { Card, Avatar, Tag, StatusPill, Button } from '@/components/ui';
import { Modal, Field, TextInput, TextArea, Select } from '@/components/Modal';
import { FilterChip } from '@/components/FilterChip';
import { Chip } from '@/components/Chip';
import { ViewToggle, type ViewKind } from '@/components/ViewToggle';
import { DatePicker } from '@/components/DatePicker';
import { Skeleton } from '@/components/Skeleton';
import { TaskPhotoGallery } from '@/components/TaskPhotoGallery';
import { TASK_STATUS_META, TASK_STATUS_ORDER, TASK_FORMAT_COLOR, shortDate } from '@/lib/display';
import { todayIso } from '@/lib/dates';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/context/ToastContext';
import { useConfirm } from '@/context/ConfirmContext';
import { useCan } from '@/lib/permissions';
import type { CreatorTask, Creator, Client, TaskStatus, TaskFormat, NewTask } from '@/types';

const FORMATS: TaskFormat[] = ['Story', 'Reels', 'Story/Reels', 'Select', 'Edição', 'Sonora', 'Banco', 'Aftermovie', 'Captação', 'Roteiro'];

export function Tasks() {
  const { user } = useApp();
  const toast = useToast();
  const confirm = useConfirm();
  const canManage = useCan('tasks');
  const tasks = useAsync<CreatorTask[]>(() => api.tasks.list(), []);
  // GET /creators e /clients são bloqueados pro operacional (nem leitura) — sem essas listas, cai no fallback.
  const creators = useAsync<Creator[]>(() => (canManage ? api.creators.list() : Promise.resolve([])), []);
  const clients = useAsync<Client[]>(() => (canManage ? api.clients.list() : Promise.resolve([])), []);
  const [view, setView] = useState<ViewKind>('tabela');
  const [modal, setModal] = useState<'new' | CreatorTask | null>(null);
  const [filterClient, setFilterClient] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<TaskStatus | null>(null);

  const allTasks = tasks.data ?? [];
  const cre = creators.data ?? [];
  const cli = clients.data ?? [];
  const creName = (id: string | null) => cre.find((c) => c.id === id)?.name ?? '—';
  const cliName = (id: string | null) => cli.find((c) => c.id === id)?.name ?? '—';

  const t = allTasks.filter((x) => (!filterClient || x.client_id === filterClient) && (!filterStatus || x.status === filterStatus));
  const clientOptions = [{ value: null, label: 'Todos' }, ...cli.map((c) => ({ value: c.id, label: c.name }))];
  const statusOptions = [{ value: null, label: 'Todos' }, ...TASK_STATUS_ORDER.map((s) => ({ value: s, label: TASK_STATUS_META[s].label }))];

  async function handleSave(data: NewTask) {
    const isNew = modal === 'new';
    try {
      if (modal !== 'new' && modal) {
        let updated = await api.tasks.update(modal.id, data);
        // PUT ignora status de propósito — só PATCH .../status grava de fato (e registra status_history).
        if (data.status !== modal.status) updated = await api.tasks.setStatus(modal.id, data.status);
        tasks.setData((prev) => (prev ?? []).map((x) => (x.id === updated.id ? updated : x)));
      } else {
        const created = await api.tasks.create(data, user!.id);
        tasks.setData((prev) => [...(prev ?? []), created]);
      }
      setModal(null);
      toast.success(isNew ? 'Tarefa criada' : 'Tarefa atualizada', `"${data.title}" foi salva.`);
    } catch (err) {
      toast.error('Não foi possível salvar', err instanceof Error ? err.message : 'Tente novamente.');
    }
  }

  async function handleDelete(task: CreatorTask) {
    if (!(await confirm({ title: 'Excluir tarefa', description: `Excluir a tarefa "${task.title}"? Essa ação não pode ser desfeita.` }))) return;
    try {
      await api.tasks.remove(task.id);
      tasks.setData((prev) => (prev ?? []).filter((x) => x.id !== task.id));
      setModal(null);
      toast.success('Tarefa excluída', `"${task.title}" foi removida.`);
    } catch (err) {
      toast.error('Não foi possível excluir', err instanceof Error ? err.message : 'Tente novamente.');
    }
  }

  return (
    <div className="cp-fade">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <ViewToggle value={view} onChange={setView} />
        <FilterChip label="Cliente" value={filterClient} options={clientOptions} onChange={setFilterClient} />
        <FilterChip label="Status" value={filterStatus} options={statusOptions} onChange={setFilterStatus} />
        {filterClient !== null && <Chip label={`Cliente: ${cliName(filterClient)}`} onRemove={() => setFilterClient(null)} />}
        {filterStatus !== null && <Chip label={`Status: ${TASK_STATUS_META[filterStatus].label}`} onRemove={() => setFilterStatus(null)} />}
        {filterClient !== null && filterStatus !== null && (
          <div onClick={() => { setFilterClient(null); setFilterStatus(null); }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(108,99,255,.1)', border: '1px solid rgba(108,99,255,.28)', borderRadius: 11, padding: '8px 12px', fontSize: 12.5, color: 'var(--pri)', fontWeight: 600, cursor: 'pointer' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M18 6L6 18M6 6l12 12" /></svg>Limpar tudo
          </div>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12.5, color: 'var(--tx3)' }}>{t.length} tarefas</span>
          {canManage && <Button icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>} onClick={() => setModal('new')}>Nova tarefa</Button>}
        </div>
      </div>

      {tasks.loading && (
        <Card pad={18}><Skeleton rows={5} /></Card>
      )}

      {!tasks.loading && view === 'tabela' && (
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2.4fr 1fr 1.4fr 1.4fr 1.3fr 90px', gap: 12, padding: '13px 18px', borderBottom: '1px solid var(--line)', fontSize: 11, fontWeight: 700, letterSpacing: '.04em', color: 'var(--tx3)' }}>
            <span>TAREFA</span><span>FORMATO</span><span>CLIENTE</span><span>CREATOR</span><span>STATUS</span><span>DATA</span>
          </div>
          {t.map((task) => (
            <div key={task.id} onClick={canManage ? () => setModal(task) : undefined} style={{ display: 'grid', gridTemplateColumns: '2.4fr 1fr 1.4fr 1.4fr 1.3fr 90px', gap: 12, padding: '13px 18px', borderBottom: '1px solid var(--line)', alignItems: 'center', fontSize: 12.5, cursor: canManage ? 'pointer' : 'default' }}>
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

      {!tasks.loading && view === 'cards' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
          {t.map((task) => (
            <Card key={task.id} pad={16} onClick={canManage ? () => setModal(task) : undefined} style={{ background: 'linear-gradient(160deg,var(--bg2),var(--bg1))', cursor: canManage ? 'pointer' : 'default' }}>
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

      {!tasks.loading && view === 'timeline' && (
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
                    <div key={task.id} onClick={canManage ? () => setModal(task) : undefined} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 13, padding: '11px 14px', cursor: canManage ? 'pointer' : 'default' }}>
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

      <TaskModal key={modal === 'new' || modal === null ? 'new' : modal.id} open={modal !== null} task={modal !== 'new' ? modal : null}
        onClose={() => setModal(null)} creators={cre} clients={cli} onSave={handleSave} onDelete={handleDelete} />
    </div>
  );
}

function TaskModal({ open, onClose, creators, clients, task, onSave, onDelete }: {
  open: boolean; onClose: () => void; creators: Creator[]; clients: Client[]; task: CreatorTask | null;
  onSave: (d: NewTask) => void; onDelete: (t: CreatorTask) => void;
}) {
  const [form, setForm] = useState<NewTask>(task
    ? { title: task.title, format_type: task.format_type, task_date: task.task_date, creator_id: task.creator_id, client_id: task.client_id, status: task.status, description: task.description }
    : { title: '', format_type: 'Story', task_date: todayIso(), creator_id: null, client_id: null, status: 'na_fila', description: null });
  const set = (k: keyof NewTask, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal open={open} title={task ? 'Editar tarefa' : 'Nova tarefa'} subtitle="Demanda para creator" onClose={onClose}
      footer={<>
        {task && <Button variant="ghost" onClick={() => onDelete(task)} style={{ color: 'var(--red)', marginRight: 'auto' }}>Excluir</Button>}
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={() => form.title && onSave(form)}>{task ? 'Salvar' : 'Criar tarefa'}</Button>
      </>}>
      <Field label="Título da tarefa"><TextInput value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Ex.: Reels institucional Q2" /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Formato"><Select value={form.format_type ?? ''} onChange={(e) => set('format_type', e.target.value)}>{FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}</Select></Field>
        <Field label="Data"><DatePicker value={form.task_date} onChange={(v) => set('task_date', v)} min={todayIso()} /></Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Creator responsável"><Select value={form.creator_id ?? ''} onChange={(e) => set('creator_id', e.target.value || null)}><option value="">—</option>{creators.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field label="Cliente"><Select value={form.client_id ?? ''} onChange={(e) => set('client_id', e.target.value || null)}><option value="">—</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
      </div>
      <Field label="Status"><Select value={form.status} onChange={(e) => set('status', e.target.value as TaskStatus)}>{TASK_STATUS_ORDER.map((s) => <option key={s} value={s}>{TASK_STATUS_META[s].label}</option>)}</Select></Field>
      <Field label="Descrição"><TextArea value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} placeholder="Detalhes da demanda…" /></Field>
      {task && <Field label="Registro da Tarefa"><TaskPhotoGallery taskId={task.id} /></Field>}
    </Modal>
  );
}
