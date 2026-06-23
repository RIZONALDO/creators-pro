export type ViewKind = 'tabela' | 'cards' | 'timeline';

const LABELS: Record<ViewKind, string> = { tabela: 'Tabela', cards: 'Cards', timeline: 'Timeline' };

const ICON_PATHS: Record<ViewKind, JSX.Element> = {
  tabela: <path d="M3 6h18M3 12h18M3 18h18" />,
  cards: <><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></>,
  timeline: <path d="M3 7h12M3 12h18M3 17h8" />,
};

const ORDER: ViewKind[] = ['tabela', 'cards', 'timeline'];

/** Alternador de visualização (Tabela/Cards/Timeline) — ícone + nome, área de toque maior. */
export function ViewToggle({ value, onChange }: { value: ViewKind; onChange: (v: ViewKind) => void }) {
  return (
    <div style={{ display: 'flex', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: 4, gap: 2 }}>
      {ORDER.map((v) => (
        <button key={v} onClick={() => onChange(v)} style={{
          display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px',
          borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
          background: value === v ? 'linear-gradient(135deg,var(--pri),var(--pri2))' : 'transparent',
          color: value === v ? '#fff' : 'var(--tx2)',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{ICON_PATHS[v]}</svg>
          {LABELS[v]}
        </button>
      ))}
    </div>
  );
}
