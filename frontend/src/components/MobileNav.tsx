import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Home, Calendar, Shield, Chat, Logout as AbsenceIcon } from 'grommet-icons';

interface NavItem { to: string; label: string; icon: ReactNode; }

const ICON_STYLE = { width: 26, height: 26 };

const ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Início', icon: <Home color="currentColor" style={ICON_STYLE} /> },
  { to: '/escala', label: 'Cronograma', icon: <Calendar color="currentColor" style={ICON_STYLE} /> },
  { to: '/plantoes', label: 'Plantões', icon: <Shield color="currentColor" style={ICON_STYLE} /> },
  { to: '/mensagens', label: 'Mensagens', icon: <Chat color="currentColor" style={ICON_STYLE} /> },
  { to: '/ausencias', label: 'Ausências', icon: <AbsenceIcon color="currentColor" style={ICON_STYLE} /> },
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
