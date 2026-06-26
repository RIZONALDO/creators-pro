import type { ComponentType } from 'react';
import { Checkmark, Alert, FormClose } from 'grommet-icons';
import type { ToastItem, ToastVariant } from '@/context/ToastContext';

const ICON: Record<ToastVariant, { stroke: string; Icon: ComponentType<{ color?: string; size?: string; style?: React.CSSProperties }> }> = {
  success: { stroke: '#22C55E', Icon: Checkmark },
  warning: { stroke: '#F59E0B', Icon: Alert },
  error: { stroke: '#EF4444', Icon: FormClose },
};

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const { stroke, Icon } = ICON[toast.variant];
  return (
    <div onClick={onDismiss} style={{
      display: 'flex', alignItems: 'center', gap: 11, background: 'var(--bg2)',
      border: `1px solid ${stroke}4D`, borderLeft: `3px solid ${stroke}`, borderRadius: 12,
      padding: '12px 14px', cursor: 'pointer', boxShadow: '0 12px 30px rgba(0,0,0,.3)',
      animation: 'cpFade .2s ease', minWidth: 240, maxWidth: 360,
    }}>
      <Icon color={stroke} size="small" style={{ flex: 'none' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{toast.title}</div>
        {toast.description && <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 1 }}>{toast.description}</div>}
      </div>
    </div>
  );
}

/**
 * Pilha de toasts. `scoped`: ancorado dentro do `.cp-phone-frame` (app mobile/PWA) — precisa ser
 * `position: absolute` porque o frame é só uma moldura central na preview desktop (≤393px); um
 * `position: fixed` ficaria ancorado na janela do navegador inteira, fora da moldura visível.
 * Sem `scoped`: painel desktop, `fixed` no canto inferior direito da janela.
 */
export function ToastViewport({ toasts, onDismiss, scoped }: { toasts: ToastItem[]; onDismiss: (id: number) => void; scoped?: boolean }) {
  if (toasts.length === 0) return null;
  return (
    <div className={`cp-toast-viewport ${scoped ? 'cp-toast-viewport--frame' : 'cp-toast-viewport--fixed'}`} style={{ zIndex: 500, display: 'flex', flexDirection: 'column', gap: 9 }}>
      {toasts.map((t) => <ToastCard key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />)}
    </div>
  );
}
