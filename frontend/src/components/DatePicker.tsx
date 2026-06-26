import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, FormPrevious, FormNext } from 'grommet-icons';
import { shortDate, monthLabel } from '@/lib/display';

const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toIso(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

/** Grade do mês: null nas posições vazias antes do dia 1 / depois do último dia. */
function buildMonthGrid(year: number, month: number): (number | null)[][] {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/**
 * Substitui <input type="date"> por um calendário próprio — o nativo é renderizado pelo SO/navegador
 * e não respeita o tema escuro do app. Tematização automática: só usa as CSS vars de theme.css
 * (mesmas que todo o resto da UI), sem nenhuma lógica extra pra dark/light.
 *
 * `large` é usado nas telas mobile (ex.: Absences) — desktop (Tasks/Services/Shifts) não passa essa
 * prop e continua exatamente do tamanho de sempre.
 *
 * `min` (opcional, YYYY-MM-DD): dias anteriores ficam visíveis mas desabilitados (clicáveis não) —
 * usado em Tarefas pra não deixar escolher data retroativa (espelha a validação do backend).
 *
 * O painel do calendário é renderizado via portal em document.body (position: fixed, posição
 * calculada a partir do botão) — Modal.tsx tem overflowY:auto no conteúdo, e um position:absolute
 * normal ficava recortado/escondido por isso quando o DatePicker é usado dentro de um modal.
 */
export function DatePicker({ value, onChange, large, min }: { value: string | null; onChange: (iso: string) => void; large?: boolean; min?: string }) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => {
    const base = value ? new Date(`${value}T00:00:00`) : new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  });
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const today = new Date();
  const todayIso = toIso(today.getFullYear(), today.getMonth(), today.getDate());

  function updatePosition() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
  }

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    // capture:true pega scroll de qualquer ancestral com overflow (ex.: o conteúdo do Modal), não só window.
    document.addEventListener('mousedown', onClickOutside);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open]);

  function openPicker() {
    const base = value ? new Date(`${value}T00:00:00`) : new Date();
    setCursor({ year: base.getFullYear(), month: base.getMonth() });
    updatePosition();
    setOpen(true);
  }

  function changeMonth(delta: number) {
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  function pick(day: number) {
    onChange(toIso(cursor.year, cursor.month, day));
    setOpen(false);
  }

  const weeks = buildMonthGrid(cursor.year, cursor.month);
  const displayValue = value ? `${shortDate(value)} ${value.slice(0, 4)}` : null;

  return (
    <div style={{ position: 'relative' }}>
      <button ref={triggerRef} type="button" onClick={openPicker} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: large ? 11 : 9, textAlign: 'left',
        background: 'var(--bg2)', borderRadius: 11, padding: large ? '14px 16px' : '10px 13px', fontSize: large ? 16 : 13, cursor: 'pointer',
        border: `1px solid ${open ? 'rgba(108,99,255,.4)' : 'var(--line)'}`,
        boxShadow: open ? '0 0 0 3px rgba(108,99,255,.12)' : 'none',
      }}>
        <Calendar color={open ? 'var(--pri)' : 'var(--tx3)'} size="small" />
        <span style={{ color: displayValue ? 'var(--tx)' : 'var(--tx3)' }}>{displayValue ?? 'Selecionar data'}</span>
      </button>

      {open && pos && createPortal(
        <div ref={popoverRef} style={{
          position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 200,
          background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 14, padding: large ? 16 : 12, boxShadow: '0 16px 40px rgba(0,0,0,.4)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: large ? 14 : 10 }}>
            <button type="button" onClick={() => changeMonth(-1)} style={{ width: large ? 36 : 28, height: large ? 36 : 28, flex: 'none', borderRadius: 9, background: 'var(--bg3)', border: '1px solid var(--line)', color: 'var(--tx2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FormPrevious color="currentColor" size="small" />
            </button>
            <span style={{ flex: 1, textAlign: 'center', fontSize: large ? 16 : 13, fontWeight: 700, fontFamily: "'Plus Jakarta Sans'", textTransform: 'capitalize' }}>{monthLabel(`${cursor.year}-${pad(cursor.month + 1)}`)}</span>
            <button type="button" onClick={() => changeMonth(1)} style={{ width: large ? 36 : 28, height: large ? 36 : 28, flex: 'none', borderRadius: 9, background: 'var(--bg3)', border: '1px solid var(--line)', color: 'var(--tx2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FormNext color="currentColor" size="small" />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 4 }}>
            {WD.map((w) => <span key={w} style={{ textAlign: 'center', fontSize: large ? 12 : 10, fontWeight: 700, color: 'var(--tx3)', padding: '4px 0' }}>{w}</span>)}
          </div>

          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
              {week.map((day, di) => {
                if (day === null) return <span key={di} />;
                const iso = toIso(cursor.year, cursor.month, day);
                const selected = iso === value;
                const isToday = iso === todayIso;
                const disabled = !!min && iso < min;
                return (
                  <button key={di} type="button" disabled={disabled} onClick={() => pick(day)} style={{
                    margin: 2, height: large ? 40 : 30, borderRadius: 9, border: isToday && !selected ? '1px solid var(--pri)' : 'none',
                    background: selected ? 'linear-gradient(135deg,var(--pri),var(--pri2))' : 'transparent',
                    color: disabled ? 'var(--tx3)' : selected ? '#fff' : 'var(--tx)', fontSize: large ? 14.5 : 12, fontWeight: selected ? 700 : 500,
                    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.35 : 1,
                  }}>
                    {day}
                  </button>
                );
              })}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
