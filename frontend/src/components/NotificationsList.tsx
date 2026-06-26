import { Checkmark, Refresh, FormClose, Sun, Alert, Camera } from 'grommet-icons';
import { useNotifications } from '@/context/NotificationsContext';
import { EmptyState } from './ui';
import { shortTime } from '@/lib/display';
import type { Notification, NotificationType } from '@/types';

const TYPE_META: Record<NotificationType, { color: string; icon: JSX.Element }> = {
  nova_tarefa: { color: '#6C63FF', icon: <Checkmark color="currentColor" size="small" /> },
  mudanca_status: { color: '#06B6D4', icon: <Refresh color="currentColor" size="small" /> },
  ausencia_aprovada: { color: '#22C55E', icon: <Checkmark color="currentColor" size="small" /> },
  ausencia_rejeitada: { color: '#EF4444', icon: <FormClose color="currentColor" size="small" /> },
  novo_plantao: { color: '#8B5CF6', icon: <Sun color="currentColor" size="small" /> },
  alteracao_escala: { color: '#F59E0B', icon: <Alert color="currentColor" size="small" /> },
  registro_tarefa: { color: '#EC4899', icon: <Camera color="currentColor" size="small" /> },
};

function NotificationRow({ n }: { n: Notification }) {
  const meta = TYPE_META[n.type as NotificationType] ?? TYPE_META.nova_tarefa;
  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 13px', borderRadius: 13, background: n.is_read ? 'transparent' : 'rgba(108,99,255,.07)' }}>
      <div style={{ width: 36, height: 36, flex: 'none', borderRadius: 10, background: `${meta.color}22`, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {meta.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{n.title}</span>
          <span style={{ fontSize: 10.5, color: 'var(--tx3)', flex: 'none' }}>{shortTime(n.created_at)}</span>
        </div>
        {n.description && <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 2, lineHeight: 1.4 }}>{n.description}</div>}
      </div>
      {!n.is_read && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--pri)', flex: 'none', marginTop: 6 }} />}
    </div>
  );
}

/** Conteúdo compartilhado entre o dropdown desktop (Topbar) e a tela cheia mobile (AppLayout/Dashboard). */
export function NotificationsList() {
  const { notifications, unreadCount, loading, markAllRead, deleteRead } = useNotifications();
  const readCount = notifications.length - unreadCount;
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 4px 10px' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx3)', letterSpacing: '.04em', textTransform: 'uppercase' }}>{unreadCount} não lida{unreadCount === 1 ? '' : 's'}</span>
        {unreadCount > 0 && <button onClick={markAllRead} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--pri)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>Marcar lidas</button>}
        {readCount > 0 && <button onClick={deleteRead} style={{ marginLeft: unreadCount > 0 ? 0 : 'auto', background: 'none', border: 'none', color: 'var(--tx3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>Limpar lidas</button>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto' }}>
        {!loading && notifications.length === 0 && <EmptyState title="Você está em dia ✦" hint="Nenhuma notificação por aqui." />}
        {notifications.map((n) => <NotificationRow key={n.id} n={n} />)}
      </div>
    </div>
  );
}
