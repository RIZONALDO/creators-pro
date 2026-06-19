import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Spinner } from '@/components/ui';

export function Login() {
  const { login } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { setError('Informe e-mail e senha.'); return; }
    setError(''); setBusy(true);
    try { await login(email, password); }
    catch { setError('Não foi possível entrar. Verifique as credenciais.'); }
    finally { setBusy(false); }
  }

  const fill = (e: string) => { setEmail(e); setPassword('demodemo'); };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'radial-gradient(1000px 600px at 50% -10%, rgba(108,99,255,.18), transparent 60%), var(--bg0)' }}>
      <div style={{ width: 420, maxWidth: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, justifyContent: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: 'linear-gradient(135deg,var(--pri),var(--pri2))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(108,99,255,.5)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 6.9H21l-5.3 4.1 2 6.9L12 15.8 6.3 20l2-6.9L3 9h6.6L12 2z" fill="#fff" /></svg>
          </div>
          <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 24, letterSpacing: '-.02em' }}>CreatorsPro</div>
        </div>

        <div style={{ background: 'var(--bg1)', border: '1px solid var(--line)', borderRadius: 22, padding: 30 }}>
          <div style={{ fontSize: 19, fontWeight: 700, fontFamily: "'Plus Jakarta Sans'" }}>Acesse o painel</div>
          <div style={{ fontSize: 13, color: 'var(--tx3)', marginTop: 4, marginBottom: 22 }}>Entre com sua conta CreatorsPro</div>

          <form onSubmit={submit}>
            <label style={{ display: 'block', marginBottom: 14 }}>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx2)', marginBottom: 6 }}>E-mail</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" autoComplete="username"
                style={{ width: '100%', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px', fontSize: 14, color: 'var(--tx)', outline: 'none' }} />
            </label>
            <label style={{ display: 'block', marginBottom: 18 }}>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx2)', marginBottom: 6 }}>Senha</span>
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" autoComplete="current-password"
                style={{ width: '100%', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px', fontSize: 14, color: 'var(--tx)', outline: 'none' }} />
            </label>

            {error && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 14 }}>{error}</div>}

            <button type="submit" disabled={busy}
              style={{ width: '100%', height: 46, borderRadius: 13, border: 'none', background: 'linear-gradient(135deg,var(--pri),var(--pri2))', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 8px 22px rgba(108,99,255,.4)' }}>
              {busy ? <Spinner /> : 'Entrar'}
            </button>
          </form>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={() => fill('fernanda@studionorte.com')} style={demoBtn}>Coordenador</button>
            <button onClick={() => fill('carlos@studionorte.com')} style={demoBtn}>Admin</button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--tx3)', textAlign: 'center', marginTop: 10 }}>Acessos demo · clique e entre</div>
        </div>
      </div>
    </div>
  );
}

const demoBtn: React.CSSProperties = {
  flex: 1, height: 44, borderRadius: 13, background: 'var(--bg2)', border: '1px solid var(--line2)',
  color: 'var(--tx)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer',
};
