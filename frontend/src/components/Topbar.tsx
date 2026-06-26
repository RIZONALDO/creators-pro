import { useApp } from '@/context/AppContext';
import { useNotifications } from '@/context/NotificationsContext';
import { useState } from 'react';
import { Sun, Moon, Notification } from 'grommet-icons';
import { NotificationsList } from './NotificationsList';

export function Topbar({ title, subtitle }: { title: string; subtitle: string }) {
  const { theme, toggleTheme } = useApp();
  const { unreadCount } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);
  return (
    <header style={{ height: 62, flex: 'none', display: 'flex', alignItems: 'center', gap: 16, padding: '0 26px', borderBottom: '1px solid var(--line)', background: 'var(--bg1)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700, fontSize: 17, letterSpacing: '-.01em' }}>{title}</div>
        <div style={{ fontSize: 11.5, color: 'var(--tx3)' }}>{subtitle}</div>
      </div>
      <div style={{ flex: 1 }} />
      <button onClick={toggleTheme} title="Alternar tema" style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--bg2)', border: '1px solid var(--line)', color: 'var(--tx2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {theme === 'dark'
          ? <Sun color="currentColor" size="small" />
          : <Moon color="currentColor" size="small" />}
      </button>
      <div style={{ position: 'relative' }}>
        <button onClick={() => setShowNotifications((s) => !s)} title="Notificações" style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--bg2)', border: '1px solid var(--line)', color: 'var(--tx2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <Notification color="currentColor" size="small" />
          {unreadCount > 0 && (
            <span style={{ position: 'absolute', top: 5, right: 6, minWidth: 16, height: 16, borderRadius: 8, background: 'var(--red)', color: '#fff', fontSize: 9.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', border: '2px solid var(--bg1)' }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
          )}
        </button>
        {showNotifications && (
          <>
            <div onClick={() => setShowNotifications(false)} style={{ position: 'fixed', inset: 0, zIndex: 299 }} />
            <div style={{ position: 'absolute', top: 46, right: 0, width: 360, maxHeight: 460, overflowY: 'auto', background: 'var(--bg1)', border: '1px solid var(--line2)', borderRadius: 16, boxShadow: '0 20px 50px rgba(0,0,0,.4)', padding: 14, zIndex: 300 }}>
              <NotificationsList />
            </div>
          </>
        )}
      </div>
    </header>
  );
}
