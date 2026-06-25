import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { AdminSidebar } from './AdminSidebar';

const META: Record<string, { title: string; subtitle: string }> = {
  '/admin': { title: 'Usuários', subtitle: 'Crie e gerencie gestores e demais acessos' },
  '/admin/cobranca': { title: 'Cobrança', subtitle: 'Assinatura, status do pagamento e portal da Stripe' },
  '/admin/configuracoes': { title: 'Configurações', subtitle: 'Dados da empresa e do app' },
  '/admin/conta': { title: 'Conta', subtitle: 'Informações da conta e exclusão permanente' },
};

/** Espelha AppLayout.tsx (Sidebar + topo fino com tema) — admin deixa de ser um header solto
 * pra virar uma área com a mesma cara do resto do produto. */
export function AdminLayout() {
  const { theme, toggleTheme } = useApp();
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();
  const meta = META[pathname] ?? { title: 'Admin', subtitle: '' };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <AdminSidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed((c) => !c)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{ height: 62, flex: 'none', display: 'flex', alignItems: 'center', gap: 16, padding: '0 26px', borderBottom: '1px solid var(--line)', background: 'var(--bg1)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
            <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700, fontSize: 17, letterSpacing: '-.01em' }}>{meta.title}</div>
            <div style={{ fontSize: 11.5, color: 'var(--tx3)' }}>{meta.subtitle}</div>
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={toggleTheme} title="Alternar tema" style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--bg2)', border: '1px solid var(--line)', color: 'var(--tx2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {theme === 'dark'
              ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></svg>
              : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>}
          </button>
        </header>
        <div style={{ flex: 1, overflowY: 'auto', padding: 26 }}>
          <div style={{ maxWidth: 1080, margin: '0 auto' }}>
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
