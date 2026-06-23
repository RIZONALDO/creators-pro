import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

export type ToastVariant = 'success' | 'warning' | 'error';
export interface ToastItem { id: number; variant: ToastVariant; title: string; description?: string; }

interface ToastContextValue {
  toasts: ToastItem[];
  dismiss: (id: number) => void;
  success: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((variant: ToastVariant, title: string, description?: string) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, variant, title, description }]);
    setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
  }, [dismiss]);

  const value: ToastContextValue = {
    toasts,
    dismiss,
    success: (title, description) => push('success', title, description),
    warning: (title, description) => push('warning', title, description),
    error: (title, description) => push('error', title, description),
  };

  // Renderização da pilha visual fica a cargo do AppLayout (que sabe se está no painel
  // desktop ou no app mobile/PWA — cada um ancora o viewport num lugar diferente).
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast deve ser usado dentro de <ToastProvider>');
  return ctx;
}
