import { MobileScreen, DetailRow } from './MobileScreen';
import { Tag, StatusPill } from './ui';
import { TaskPhotoRecord } from './TaskPhotoRecord';
import { TASK_STATUS_META, TASK_FORMAT_COLOR, shortDate } from '@/lib/display';
import type { CreatorTask } from '@/types';

/** Detalhes de uma tarefa (app mobile) — aberta a partir do Início ou do Cronograma. */
export function TaskDetailScreen({ task, onClose }: { task: CreatorTask; onClose: () => void }) {
  return (
    <MobileScreen title="Detalhes da tarefa" onBack={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 16 }}>
        {task.format_type && <Tag label={task.format_type} color={TASK_FORMAT_COLOR[task.format_type]} />}
        <span style={{ marginLeft: 'auto' }}><StatusPill meta={TASK_STATUS_META[task.status]} /></span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Plus Jakarta Sans'", lineHeight: 1.3, marginBottom: 18 }}>{task.title}</div>
      <DetailRow label="Cliente" value={task.client_name ?? '—'} />
      <DetailRow label="Data" value={shortDate(task.task_date)} />
      {task.description && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 9 }}>Descrição</div>
          <div style={{ fontSize: 14.5, color: 'var(--tx2)', lineHeight: 1.55, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 14, padding: 14 }}>{task.description}</div>
        </div>
      )}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 9 }}>Registro da Tarefa</div>
        <TaskPhotoRecord taskId={task.id} />
      </div>
    </MobileScreen>
  );
}
