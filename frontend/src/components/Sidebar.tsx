import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useApp } from '@/context/AppContext';
import { Avatar } from './ui';

interface NavItem { to: string; label: string; icon: ReactNode; }

const I = (d: string) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

const MAIN: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg> },
  { to: '/tarefas', label: 'Tarefas', icon: I('M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11') },
  { to: '/servicos', label: 'Outros Serviços', icon: I('M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z') },
  { to: '/escala', label: 'Escala', icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2.5" /><path d="M16 2v4M8 2v4M3 10h18" /></svg> },
];

const GESTAO: NavItem[] = [
  { to: '/ausencias', label: 'Ausências', icon: I('M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 0M22 11h-6') },
  { to: '/plantoes', label: 'Plantões', icon: I('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z') },
  { to: '/mensagens', label: 'Mensagens', icon: I('M21 11.5a8.38 8.38 0 0 1-9 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.2A8.5 8.5 0 0 1 12 3a8.38 8.38 0 0 1 9 8.5z') },
  { to: '/relatorios', label: 'Relatórios', icon: I('M3 3v18h18M7 14l4-4 3 3 5-6') },
  { to: '/cadastros', label: 'Cadastros', icon: I('M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 0M19 8v6M22 11h-6') },
];

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const { user } = useApp();
  const w = collapsed ? 76 : 250;

  const renderItem = (item: NavItem) => (
    <NavLink
      key={item.to}
      to={item.to}
      title={collapsed ? item.label : undefined}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', borderRadius: 12,
        textDecoration: 'none', fontSize: 13, fontWeight: isActive ? 600 : 500,
        justifyContent: collapsed ? 'center' : 'flex-start',
        border: '1px solid ' + (isActive ? 'rgba(108,99,255,.32)' : 'transparent'),
        background: isActive ? 'linear-gradient(100deg, rgba(108,99,255,.20), rgba(139,92,246,.10))' : 'transparent',
        color: isActive ? 'var(--pri)' : 'var(--tx2)',
        transition: 'all .15s',
      })}
    >
      {item.icon}
      {!collapsed && <span>{item.label}</span>}
    </NavLink>
  );

  return (
    <aside style={{ width: w, flex: 'none', display: 'flex', flexDirection: 'column', background: 'var(--bg1)', borderRight: '1px solid var(--line)', padding: '18px 14px', gap: 4, transition: 'width .25s cubic-bezier(.4,0,.2,1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '6px 8px 16px', justifyContent: collapsed ? 'center' : 'flex-start' }}>
        <div style={{ width: 36, height: 36, borderRadius: 11, flex: 'none', background: 'linear-gradient(135deg,var(--pri),var(--pri2))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(108,99,255,.45)' }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 6.9H21l-5.3 4.1 2 6.9L12 15.8 6.3 20l2-6.9L3 9h6.6L12 2z" fill="#fff" /></svg>
        </div>
        {!collapsed && (
          <div style={{ lineHeight: 1.05 }}>
            <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 16, letterSpacing: '-.02em' }}>CreatorsPro</div>
            <div style={{ fontSize: 10.5, color: 'var(--tx3)', fontWeight: 600, letterSpacing: '.04em' }}>OPERAÇÕES</div>
          </div>
        )}
      </div>

      {!collapsed && <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', color: 'var(--tx3)', padding: '6px 10px 4px' }}>PRINCIPAL</div>}
      {MAIN.map(renderItem)}

      {!collapsed && <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', color: 'var(--tx3)', padding: '14px 10px 4px' }}>GESTÃO</div>}
      {GESTAO.map(renderItem)}

      <div style={{ marginTop: 'auto' }}>
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 13, background: 'var(--bg2)', border: '1px solid var(--line)', justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <Avatar name={user.name} size={32} />
            {!collapsed && (
              <div style={{ lineHeight: 1.2, minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
                <div style={{ fontSize: 10.5, color: 'var(--tx3)' }}>Coordenadora</div>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
