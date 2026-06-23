import { useEffect, useRef, useState } from 'react';

/** Chip com dropdown de opções (ex.: "Cliente: Todos") — fecha ao escolher uma opção ou clicar fora. */
export function FilterChip<T extends string>({ label, value, options, onChange }: {
  label: string; value: T | null; options: { value: T | null; label: string }[]; onChange: (v: T | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value)?.label ?? 'Todos';

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div onClick={() => setOpen((o) => !o)} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 11, padding: '8px 12px', fontSize: 12.5, color: 'var(--tx2)', cursor: 'pointer' }}>
        {label}: <span style={{ color: 'var(--tx)', fontWeight: 600 }}>{current}</span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 30, minWidth: 190, maxHeight: 280, overflowY: 'auto', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 12, padding: 6, boxShadow: '0 16px 40px rgba(0,0,0,.4)' }}>
          {options.map((o) => (
            <div key={o.label} onClick={() => { onChange(o.value); setOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9, fontSize: 12.5, color: 'var(--tx)', cursor: 'pointer' }}>
              <span style={{ width: 14, color: 'var(--pri)', fontWeight: 700 }}>{o.value === value ? '✓' : ''}</span>{o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
