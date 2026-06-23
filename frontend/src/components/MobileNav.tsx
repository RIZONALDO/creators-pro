import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';

interface NavItem { to: string; label: string; icon: ReactNode; }

const I = (d: string) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={d} /></svg>
);

const ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Início', icon: I('M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z') },
  { to: '/escala', label: 'Cronograma', icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg> },
  { to: '/plantoes', label: 'Plantões', icon: I('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z') },
  { to: '/mensagens', label: 'Mensagens', icon: I('M21 11.5a8.38 8.38 0 0 1-9 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.2A8.5 8.5 0 0 1 12 3a8.38 8.38 0 0 1 9 8.5z') },
  { to: '/ausencias', label: 'Ausências', icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 11h-6" /></svg> },
];

/** Navegação do app mobile (papel operacional) — substitui a Sidebar desktop. Fiel ao HTML de referência (seção MOBILE). */
export function MobileNav() {
  return (
    <nav style={{ height: 84, flex: 'none', background: 'var(--bg1)', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 6px', paddingBottom: 'env(safe-area-inset-bottom, 0px)', boxSizing: 'content-box' }}>
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          style={({ isActive }) => ({
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
            textDecoration: 'none', fontSize: 11.5, fontWeight: isActive ? 700 : 500,
            color: isActive ? 'var(--pri)' : 'var(--tx3)',
          })}
        >
          {item.icon}
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
