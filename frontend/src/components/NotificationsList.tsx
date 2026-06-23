import { useNotifications } from '@/context/NotificationsContext';
import { EmptyState } from './ui';
import { shortTime } from '@/lib/display';
import type { Notification, NotificationType } from '@/types';

const TYPE_META: Record<NotificationType, { color: string; icon: JSX.Element }> = {
  nova_tarefa: { color: '#6C63FF', icon: <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /> },
  mudanca_status: { color: '#06B6D4', icon: <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" /> },
  ausencia_aprovada: { color: '#22C55E', icon: <path d="M20 6L9 17l-5-5" /> },
  ausencia_rejeitada: { color: '#EF4444', icon: <path d="M18 6L6 18M6 6l12 12" /> },
  novo_plantao: { color: '#8B5CF6', icon: <><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M1 12h2M21 12h2" /></> },
  alteracao_escala: { color: '#F59E0B', icon: <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /> },
  registro_tarefa: { color: '#EC4899', icon: <><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></> },
};

function NotificationRow({ n }: { n: Notification }) {
  const meta = TYPE_META[n.type as NotificationType] ?? TYPE_META.nova_tarefa;
  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 13px', borderRadius: 13, background: n.is_read ? 'transparent' : 'rgba(108,99,255,.07)' }}>
      <div style={{ width: 36, height: 36, flex: 'none', borderRadius: 10, background: `${meta.color}22`, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">{meta.icon}</svg>
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
  const { notifications, unreadCount, loading, markAllRead } = useNotifications();
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '2px 4px 10px' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx3)', letterSpacing: '.04em', textTransform: 'uppercase' }}>{unreadCount} não lida{unreadCount === 1 ? '' : 's'}</span>
        {unreadCount > 0 && <button onClick={markAllRead} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--pri)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>Marcar lidas</button>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto' }}>
        {!loading && notifications.length === 0 && <EmptyState title="Você está em dia ✦" hint="Nenhuma notificação por aqui." />}
        {notifications.map((n) => <NotificationRow key={n.id} n={n} />)}
      </div>
    </div>
  );
}
