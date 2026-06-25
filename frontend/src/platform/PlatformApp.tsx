import { useState } from 'react';
import { PlatformProvider, usePlatform } from './context/PlatformContext';
import { PlatformLogin } from './PlatformLogin';
import { Tenants } from './screens/Tenants';
import { TenantDetail } from './screens/TenantDetail';
import { Plans } from './screens/Plans';
import { Settings } from './screens/Settings';

type Screen =
  | { name: 'tenants' }
  | { name: 'tenant'; id: string }
  | { name: 'plans' }
  | { name: 'settings' };

function PlatformShell() {
  const { admin, loading, logout } = usePlatform();
  const [screen, setScreen] = useState<Screen>({ name: 'tenants' });

  if (loading) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg0)', color: 'var(--tx2)', fontSize: 14 }}>Carregando…</div>
  );

  if (!admin) return <PlatformLogin />;

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', background: 'var(--bg0)' }}>
      {/* Sidebar */}
      <div style={{ width: 220, background: 'var(--bg1)', borderRight: '1px solid var(--line)', padding: '24px 0', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '0 20px', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 28, height: 28, background: 'var(--pri)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><path d="M12 2a5 5 0 1 1 0 10A5 5 0 0 1 12 2zM4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>
            </div>
            <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 15, color: 'var(--tx)' }}>SuperAdmin</span>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '0 10px' }}>
          <NavItem
            active={screen.name === 'tenants' || screen.name === 'tenant'}
            onClick={() => setScreen({ name: 'tenants' })}
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>}
          >Tenants</NavItem>

          <NavItem
            active={screen.name === 'plans'}
            onClick={() => setScreen({ name: 'plans' })}
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>}
          >Planos</NavItem>

          <NavItem
            active={screen.name === 'settings'}
            onClick={() => setScreen({ name: 'settings' })}
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>}
          >Configurações</NavItem>
        </nav>

        <div style={{ padding: '16px 10px 0', borderTop: '1px solid var(--line)' }}>
          <div style={{ padding: '8px 10px', marginBottom: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx)' }}>{admin.name}</div>
            <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{admin.email}</div>
          </div>
          <button onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx2)', fontSize: 13, padding: '8px 10px', borderRadius: 9, textAlign: 'left' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
            Sair
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
        {(screen.name === 'tenants') && (
          <Tenants onSelect={(id) => setScreen({ name: 'tenant', id })} />
        )}
        {screen.name === 'tenant' && (
          <TenantDetail id={screen.id} onBack={() => setScreen({ name: 'tenants' })} />
        )}
        {screen.name === 'plans' && <Plans />}
        {screen.name === 'settings' && <Settings />}
      </div>
    </div>
  );
}

function NavItem({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', background: active ? 'var(--bg3)' : 'none', border: 'none', cursor: 'pointer', color: active ? 'var(--tx)' : 'var(--tx2)', fontSize: 13, fontWeight: active ? 700 : 400, padding: '9px 10px', borderRadius: 9, textAlign: 'left', marginBottom: 2 }}>
      {icon}
      {children}
    </button>
  );
}

export function PlatformApp() {
  return (
    <PlatformProvider>
      <PlatformShell />
    </PlatformProvider>
  );
}
