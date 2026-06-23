import { useEffect, useState } from 'react';

function now() {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Barra de status (relógio real + sinal/wifi/bateria) — simula o topo de um iPhone. */
export function MobileStatusBar() {
  const [time, setTime] = useState(now);
  useEffect(() => {
    const id = setInterval(() => setTime(now()), 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ height: 52, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 26px', fontSize: 15, fontWeight: 700, color: 'var(--tx)' }}>
      <span>{time}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <svg width="20" height="14" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="7" width="3" height="5" rx="0.8" /><rect x="5" y="4.5" width="3" height="7.5" rx="0.8" /><rect x="10" y="2" width="3" height="10" rx="0.8" /><rect x="15" y="0" width="3" height="12" rx="0.8" opacity=".35" /></svg>
        <svg width="19" height="14" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M1 4.5a10 10 0 0 1 14 0" /><path d="M3.6 7.3a6.3 6.3 0 0 1 8.8 0" /><path d="M6.3 10a2.6 2.6 0 0 1 3.4 0" /></svg>
        <svg width="29" height="15" viewBox="0 0 24 13" fill="none"><rect x="0.5" y="0.5" width="20" height="12" rx="3" stroke="currentColor" opacity=".4" /><rect x="2" y="2" width="17" height="9" rx="2" fill="currentColor" /><rect x="21.5" y="4" width="1.7" height="5" rx="0.8" fill="currentColor" opacity=".4" /></svg>
      </span>
    </div>
  );
}
