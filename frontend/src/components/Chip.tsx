/** Chip removível (ex.: filtro ativo) — fiel à referência: bg3 + borda line2, × pra remover. */
export function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span style={{
      display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: 'var(--tx)',
      background: 'var(--bg3)', border: '1px solid var(--line2)', padding: '5px 9px 5px 11px', borderRadius: 9,
    }}>
      {label}
      <svg onClick={onRemove} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--tx3)" strokeWidth="2.4" style={{ cursor: 'pointer' }}>
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </span>
  );
}
