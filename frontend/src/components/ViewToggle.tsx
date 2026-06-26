import { List, Grid } from 'grommet-icons';

export type ViewKind = 'tabela' | 'cards' | 'timeline';

const LABELS: Record<ViewKind, string> = { tabela: 'Tabela', cards: 'Cards', timeline: 'Timeline' };

const ICONS: Record<ViewKind, JSX.Element> = {
  tabela: <List color="currentColor" size="small" />,
  cards: <Grid color="currentColor" size="small" />,
  timeline: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7h12M3 12h18M3 17h8" /></svg>,
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
          {ICONS[v]}
          {LABELS[v]}
        </button>
      ))}
    </div>
  );
}
