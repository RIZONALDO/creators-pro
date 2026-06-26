import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '@/api';
import { connectRealtime } from '@/api/socket';
import { getAuthToken } from '@/api/client';
import { useApp } from './AppContext';
import type { Notification, NotificationType } from '@/types';

type RefreshListener = { types: NotificationType[]; cb: () => void };

interface NotificationsContextValue {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markAllRead: () => Promise<void>;
  deleteRead: () => Promise<void>;
  reload: () => void;
  /** Registra `cb` pra rodar sempre que uma notification de um dos `types` chegar ao vivo — ver `useRealtimeRefresh`. */
  subscribe: (types: NotificationType[], cb: () => void) => () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

/**
 * Lista + contador do sino ficam num context próprio (Topbar/AppLayout/Dashboard consomem sem
 * prop-drilling). Esse mesmo fluxo (notification:new chegando ao vivo) também serve de gatilho
 * de "refetch" pras telas que mostram o dado que mudou — ver `useRealtimeRefresh` no fim do
 * arquivo: tarefa criada/status mudou, plantão novo, ausência revisada não atualizavam o app
 * mobile (Dashboard/Cronograma/Plantões/Ausências) até alguém recarregar a tela manualmente.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useApp();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const listenersRef = useRef<Set<RefreshListener>>(new Set());

  const reload = useCallback(() => {
    if (!user) return;
    setLoading(true);
    api.notifications.list().then((data) => { setNotifications(data); setLoading(false); });
  }, [user]);

  useEffect(() => {
    if (!user) { setNotifications([]); return; }
    reload();
  }, [user, reload]);

  // notification:new chega na mesma conexão usada pelo chat (room user:<id> — backend/src/realtime).
  useEffect(() => {
    if (!user) return;
    const socket = connectRealtime(getAuthToken());
    const off = socket.onNotification((n) => {
      setNotifications((prev) => (prev.some((x) => x.id === n.id) ? prev : [n, ...prev]));
      for (const listener of listenersRef.current) {
        if (listener.types.includes(n.type as NotificationType)) listener.cb();
      }
    });
    return () => { off(); socket.disconnect(); };
  }, [user]);

  const subscribe = useCallback((types: NotificationType[], cb: () => void) => {
    const listener: RefreshListener = { types, cb };
    listenersRef.current.add(listener);
    return () => { listenersRef.current.delete(listener); };
  }, []);

  async function markAllRead() {
    await api.notifications.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  async function deleteRead() {
    await api.notifications.deleteRead();
    setNotifications((prev) => prev.filter((n) => !n.is_read));
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, loading, markAllRead, deleteRead, reload, subscribe }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications deve ser usado dentro de <NotificationsProvider>');
  return ctx;
}

/**
 * Roda `callback` sempre que uma notification de um dos `types` chegar ao vivo — uso típico:
 * `useRealtimeRefresh(['nova_tarefa', 'mudanca_status'], tasks.reload)`. `types` deve ser uma
 * constante (array literal fora do componente ou estável via useMemo) — é usado como dependência
 * por valor (join), não por referência.
 */
export function useRealtimeRefresh(types: NotificationType[], callback: () => void) {
  const { subscribe } = useNotifications();
  const callbackRef = useRef(callback);
  useEffect(() => { callbackRef.current = callback; }, [callback]);

  const typesKey = types.join(',');
  useEffect(() => {
    return subscribe(types, () => callbackRef.current());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe, typesKey]);
}
