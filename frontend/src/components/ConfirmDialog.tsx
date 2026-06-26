import { Alert } from 'grommet-icons';
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
          <Alert color="#EF4444" size="small" />
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--tx2)', lineHeight: 1.5, paddingTop: 6 }}>{description}</div>
      </div>
    </Modal>
  );
}
