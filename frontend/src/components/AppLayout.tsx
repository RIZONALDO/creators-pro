import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

const META: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Visão geral da operação · Junho 2026' },
  '/tarefas': { title: 'Gestão de Tarefas', subtitle: 'Acompanhe a produção de conteúdo' },
  '/servicos': { title: 'Outros Serviços', subtitle: 'Drone, foto, edição e sonora' },
  '/escala': { title: 'Escala de Creators', subtitle: 'Distribuição de creators · dias úteis' },
  '/ausencias': { title: 'Ausências', subtitle: 'Solicitações e aprovações' },
  '/plantoes': { title: 'Plantões', subtitle: 'Controle de plantões de fim de semana' },
  '/mensagens': { title: 'Mensagens', subtitle: 'Central de comunicação interna' },
  '/relatorios': { title: 'Relatórios', subtitle: 'Indicadores e exportações' },
  '/cadastros': { title: 'Cadastros', subtitle: 'Creators, colaboradores e clientes' },
};

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();
  const meta = META[pathname] ?? { title: 'CreatorsPro', subtitle: '' };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <Sidebar collapsed={collapsed} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar title={meta.title} subtitle={meta.subtitle} onToggleSidebar={() => setCollapsed((c) => !c)} />
        <div style={{ flex: 1, overflowY: 'auto', padding: 26 }}>
          <div style={{ maxWidth: 1320, margin: '0 auto' }}>
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
