import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sun, Moon } from 'grommet-icons';
import { useApp } from '@/context/AppContext';
import { AdminSidebar } from './AdminSidebar';

const META: Record<string, { title: string; subtitle: string }> = {
  '/admin': { title: 'Usuários', subtitle: 'Crie e gerencie gestores e demais acessos' },
  '/admin/cobranca': { title: 'Cobrança', subtitle: 'Assinatura, status do pagamento e portal da Stripe' },
  '/admin/configuracoes': { title: 'Configurações', subtitle: 'Dados da empresa e do app' },
  '/admin/conta': { title: 'Conta', subtitle: 'Informações da conta e exclusão permanente' },
  '/admin/perfil': { title: 'Editar perfil', subtitle: 'Seus dados de acesso' },
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
              ? <Sun color="currentColor" size="small" />
              : <Moon color="currentColor" size="small" />}
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
