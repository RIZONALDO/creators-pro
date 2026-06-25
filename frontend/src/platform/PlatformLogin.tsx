import { useState } from 'react';
import { ApiError } from '@/api/client';
import { usePlatform } from './context/PlatformContext';

export function PlatformLogin() {
  const { login } = usePlatform();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { setError('Informe e-mail e senha.'); return; }
    setError(''); setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível conectar ao servidor.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg0)' }}>
      <div style={{ width: '100%', maxWidth: 380, padding: 24 }}>
        <div style={{ background: 'var(--bg1)', border: '1px solid var(--line)', borderRadius: 22, padding: 32 }}>
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 32, height: 32, background: 'var(--pri)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><path d="M12 2a5 5 0 1 1 0 10A5 5 0 0 1 12 2zM4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>
              </div>
              <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 18, color: 'var(--tx)' }}>SuperAdmin</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--tx2)' }}>Acesso restrito à equipe CreatorsPro</div>
          </div>

          <form onSubmit={submit}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx2)', marginBottom: 6 }}>E-mail</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 13px', fontSize: 14, color: 'var(--tx)', outline: 'none', boxSizing: 'border-box' }}
                autoComplete="email"
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx2)', marginBottom: 6 }}>Senha</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 13px', fontSize: 14, color: 'var(--tx)', outline: 'none', boxSizing: 'border-box' }}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div style={{ fontSize: 13, color: 'var(--red)', marginBottom: 14, padding: '10px 12px', background: 'rgba(239,68,68,.08)', borderRadius: 8 }}>{error}</div>
            )}

            <button type="submit" disabled={busy} style={{ width: '100%', background: 'var(--pri)', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 0', fontSize: 14, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}>
              {busy ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
