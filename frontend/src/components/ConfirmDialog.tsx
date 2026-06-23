import { Modal } from './Modal';
import { Button } from './ui';

export function ConfirmDialog({ title, description, confirmLabel = 'Excluir', onConfirm, onCancel }: {
  title: string; description: string; confirmLabel?: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <Modal open title={title} onClose={onCancel} width={400}
      footer={<>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button onClick={onConfirm} style={{ background: 'var(--red)', boxShadow: '0 5px 16px rgba(239,68,68,.35)' }}>{confirmLabel}</Button>
      </>}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(239,68,68,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.2"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--tx2)', lineHeight: 1.5, paddingTop: 6 }}>{description}</div>
      </div>
    </Modal>
  );
}
