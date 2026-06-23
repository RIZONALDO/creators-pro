import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export interface ConfirmOptions { title: string; description: string; confirmLabel?: string; }
interface PendingConfirm extends ConfirmOptions { resolve: (ok: boolean) => void; }

const ConfirmContext = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null);

/** Substitui `window.confirm()` (dialog nativo do navegador) por um modal do próprio design system. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => setPending({ ...opts, resolve }));
  }, []);

  function settle(ok: boolean) {
    pending?.resolve(ok);
    setPending(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <ConfirmDialog title={pending.title} description={pending.description} confirmLabel={pending.confirmLabel}
          onConfirm={() => settle(true)} onCancel={() => settle(false)} />
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): (opts: ConfirmOptions) => Promise<boolean> {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm deve ser usado dentro de <ConfirmProvider>');
  return ctx;
}
