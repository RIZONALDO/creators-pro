import { FormClose } from 'grommet-icons';

/** Chip removível (ex.: filtro ativo) — fiel à referência: bg3 + borda line2, × pra remover. */
export function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span style={{
      display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: 'var(--tx)',
      background: 'var(--bg3)', border: '1px solid var(--line2)', padding: '5px 9px 5px 11px', borderRadius: 9,
    }}>
      {label}
      <FormClose onClick={onRemove} color="var(--tx3)" size="small" style={{ cursor: 'pointer' }} />
    </span>
  );
}
