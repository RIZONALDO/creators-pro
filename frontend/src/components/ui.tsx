import type { CSSProperties, ReactNode } from 'react';
import type { StatusMeta } from '@/types';
import { avatarColor, initials } from '@/lib/display';

/* ---------------- Avatar ---------------- */
export function Avatar({ name, size = 34, seed }: { name: string; size?: number; seed?: string }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%', flex: 'none',
        background: avatarColor(seed ?? name), color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.36, fontWeight: 700,
      }}
    >
      {initials(name)}
    </div>
  );
}

/* ---------------- StatusPill ---------------- */
export function StatusPill({ meta }: { meta: StatusMeta }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: meta.color, background: meta.bg, padding: '3px 9px', borderRadius: 7, whiteSpace: 'nowrap' }}>
      {meta.label}
    </span>
  );
}

/* ---------------- Tag (formato) ---------------- */
export function Tag({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, color, background: `${color}22`, padding: '2px 8px', borderRadius: 6 }}>
      {label}
    </span>
  );
}

/* ---------------- Button ---------------- */
type BtnVariant = 'primary' | 'ghost' | 'soft';
export function Button({ children, variant = 'primary', onClick, icon, style, type = 'button' }: {
  children: ReactNode; variant?: BtnVariant; onClick?: () => void; icon?: ReactNode; style?: CSSProperties; type?: 'button' | 'submit';
}) {
  const base: CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    border: 'none', borderRadius: 11, padding: '9px 15px', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', transition: 'all .15s', ...style,
  };
  const variants: Record<BtnVariant, CSSProperties> = {
    primary: { background: 'linear-gradient(135deg, var(--pri), var(--pri2))', color: '#fff', boxShadow: '0 5px 16px rgba(108,99,255,.35)' },
    ghost: { background: 'var(--bg2)', color: 'var(--tx2)', border: '1px solid var(--line)' },
    soft: { background: 'rgba(108,99,255,.1)', color: 'var(--pri)', border: '1px solid rgba(108,99,255,.25)' },
  };
  return (
    <button type={type} onClick={onClick} style={{ ...base, ...variants[variant] }}>
      {icon}{children}
    </button>
  );
}

/* ---------------- Card ---------------- */
export function Card({ children, style, pad = 18 }: { children: ReactNode; style?: CSSProperties; pad?: number }) {
  return (
    <div style={{ background: 'var(--bg1)', border: '1px solid var(--line)', borderRadius: 18, padding: pad, ...style }}>
      {children}
    </div>
  );
}

/* ---------------- Spinner ---------------- */
export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <span style={{ width: size, height: size, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'cpSpin .7s linear infinite' }} />
  );
}

/* ---------------- EmptyState ---------------- */
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--tx3)' }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx2)', fontFamily: "'Plus Jakarta Sans'" }}>{title}</div>
      {hint && <div style={{ fontSize: 12.5, marginTop: 6 }}>{hint}</div>}
    </div>
  );
}
