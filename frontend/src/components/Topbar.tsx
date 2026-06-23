import { useApp } from '@/context/AppContext';
import { useNotifications } from '@/context/NotificationsContext';
import { useState } from 'react';
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
          ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></svg>
          : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>}
      </button>
      <div style={{ position: 'relative' }}>
        <button onClick={() => setShowNotifications((s) => !s)} title="Notificações" style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--bg2)', border: '1px solid var(--line)', color: 'var(--tx2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
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
