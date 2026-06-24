import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { UserAdmin, Configure, CreditCard, Sidebar as SidebarIcon } from 'grommet-icons';
import { api } from '@/api';
import { useApp } from '@/context/AppContext';
import { useAsync } from '@/lib/useAsync';
import { Avatar } from './ui';
import { ProfileModal } from './ProfileModal';
import { roleLabel } from '@/lib/display';
import type { CompanySettings } from '@/types';

interface NavItem { to: string; label: string; icon: typeof UserAdmin; }

const ICON_SIZE = '17px';

const NAV: NavItem[] = [
  { to: '/admin', label: 'Usuários', icon: UserAdmin },
  { to: '/admin/cobranca', label: 'Cobrança', icon: CreditCard },
  { to: '/admin/configuracoes', label: 'Configurações', icon: Configure },
];

/** Espelha Sidebar.tsx (mesma estrutura visual: logo colapsável, itens com ícone, perfil no
 * rodapé) — admin é uma área separada do gestor, mas precisa parecer o mesmo produto. */
export function AdminSidebar({ collapsed, onToggleCollapse }: { collapsed: boolean; onToggleCollapse: () => void }) {
  const { user } = useApp();
  const [profile, setProfile] = useState(false);
  const company = useAsync<CompanySettings>(() => api.company.get(), []);
  const appName = company.data?.app_name;
  const appSubtitle = company.data?.app_subtitle;
  const w = collapsed ? 76 : 250;

  return (
    <aside style={{ width: w, flex: 'none', display: 'flex', flexDirection: 'column', background: 'var(--bg1)', borderRight: '1px solid var(--line)', padding: '18px 14px', gap: 4, transition: 'width .25s cubic-bezier(.4,0,.2,1)' }}>
      <button onClick={onToggleCollapse} title={collapsed ? 'Expandir menu' : 'Recolher menu'} style={{
        display: 'flex', alignItems: 'center', gap: 11, padding: '6px 8px 16px', justifyContent: collapsed ? 'center' : 'flex-start',
        background: 'transparent', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
      }}>
        <div style={{ width: 36, height: 36, borderRadius: 11, flex: 'none', background: 'linear-gradient(135deg,var(--pri),var(--pri2))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(108,99,255,.45)' }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 6.9H21l-5.3 4.1 2 6.9L12 15.8 6.3 20l2-6.9L3 9h6.6L12 2z" fill="#fff" /></svg>
        </div>
        {!collapsed && (
          <>
            <div style={{ lineHeight: 1.05, minWidth: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 16, letterSpacing: '-.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{appName ?? 'CreatorsPro'}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--pri2)', background: 'rgba(139,92,246,.16)', padding: '1px 7px', borderRadius: 6, flex: 'none' }}>ADMIN</span>
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--tx3)', fontWeight: 600, letterSpacing: '.04em' }}>{appSubtitle ?? 'OPERAÇÕES'}</div>
            </div>
            <SidebarIcon color="var(--tx3)" size="16px" style={{ marginLeft: 'auto', flex: 'none' }} />
          </>
        )}
      </button>

      {!collapsed && <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', color: 'var(--tx3)', padding: '6px 10px 4px' }}>ADMINISTRAÇÃO</div>}
      {NAV.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end
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
            <Icon color="currentColor" size={ICON_SIZE} />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        );
      })}

      <div style={{ marginTop: 'auto' }}>
        {user && (
          <button onClick={() => setProfile(true)} title="Perfil e sair" style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 10px', borderRadius: 13,
            background: 'var(--bg2)', border: '1px solid var(--line)', justifyContent: collapsed ? 'center' : 'flex-start', cursor: 'pointer',
          }}>
            <Avatar name={user.name} size={32} imageUrl={user.avatar_url} />
            {!collapsed && (
              <div style={{ lineHeight: 1.2, minWidth: 0, flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
                <div style={{ fontSize: 10.5, color: 'var(--tx3)' }}>{roleLabel(user)}</div>
              </div>
            )}
          </button>
        )}
      </div>

      <ProfileModal open={profile} onClose={() => setProfile(false)} name={user?.name ?? ''} email={user?.email ?? ''} phone={user?.phone ?? ''} />
    </aside>
  );
}
