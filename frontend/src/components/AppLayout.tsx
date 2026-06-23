import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/context/ToastContext';
import { useNotifications } from '@/context/NotificationsContext';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileNav } from './MobileNav';
import { MobileStatusBar } from './MobileStatusBar';
import { ToastViewport } from './Toast';
import { MobileScreen } from './MobileScreen';
import { NotificationsList } from './NotificationsList';

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

// Cópia própria do app mobile — mesmas rotas, texto fiel ao HTML de referência (seção MOBILE), que
// difere do painel do coordenador. /dashboard não entra aqui: a tela Início monta seu próprio
// cabeçalho (avatar + saudação), sem essa barra de título.
const MOBILE_META: Record<string, { title: string; subtitle: string }> = {
  '/escala': { title: 'Cronograma', subtitle: 'Sua escala da semana' },
  '/ausencias': { title: 'Ausências', subtitle: 'Solicite e acompanhe' },
  '/plantoes': { title: 'Plantões', subtitle: 'Seus plantões de fim de semana' },
  '/mensagens': { title: 'Mensagens', subtitle: 'Converse com a coordenação' },
};

export function AppLayout() {
  const { user } = useApp();
  const { toasts, dismiss } = useToast();
  const { unreadCount } = useNotifications();
  const [collapsed, setCollapsed] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const { pathname } = useLocation();
  const meta = META[pathname] ?? { title: 'CreatorsPro', subtitle: '' };

  // operacional usa o app mobile (abas inferiores) — coordenador/gestor mantém o painel desktop.
  if (user?.role === 'operacional') {
    const isHome = pathname === '/dashboard';
    const isProfile = pathname === '/perfil';
    const mobileMeta = MOBILE_META[pathname];
    return (
      <div style={{ height: '100dvh', width: '100dvw', overflow: 'hidden', display: 'flex', justifyContent: 'center', background: 'var(--bg0)' }}>
        <div className="cp-phone-frame" style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingLeft: 'env(safe-area-inset-left, 0px)',
          paddingRight: 'env(safe-area-inset-right, 0px)',
        }}>
          <div className="cp-fake-statusbar"><MobileStatusBar /></div>
          {!isHome && !isProfile && mobileMeta && (
            <div style={{ flex: 'none', padding: '8px 18px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Plus Jakarta Sans'" }}>{mobileMeta.title}</div>
                <div style={{ fontSize: 13.5, color: 'var(--tx3)', marginTop: 3 }}>{mobileMeta.subtitle}</div>
              </div>
              <button onClick={() => setShowNotifications(true)} style={{ width: 46, height: 46, flex: 'none', borderRadius: 13, background: 'var(--bg2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="var(--tx2)" strokeWidth="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
                {unreadCount > 0 && (
                  <span style={{ position: 'absolute', top: 6, right: 7, minWidth: 17, height: 17, borderRadius: 9, background: 'var(--red)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', border: '2px solid var(--bg1)' }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </button>
            </div>
          )}
          <div style={{ flex: 1, overflowY: 'auto', padding: isProfile ? 0 : isHome ? '10px 18px 14px' : '0 18px 14px' }}>
            <Outlet />
          </div>
          {!isProfile && <MobileNav />}
          <ToastViewport toasts={toasts} onDismiss={dismiss} scoped />
          {showNotifications && <MobileScreen title="Notificações" onBack={() => setShowNotifications(false)}><NotificationsList /></MobileScreen>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed((c) => !c)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar title={meta.title} subtitle={meta.subtitle} />
        <div style={{ flex: 1, overflowY: 'auto', padding: 26 }}>
          <div style={{ maxWidth: 1320, margin: '0 auto' }}>
            <Outlet />
          </div>
        </div>
      </div>
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
