import { useState } from 'react';
import { ApiError } from '@/api/client';
import { usePlatform } from './context/PlatformContext';

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg2)', border: '1px solid var(--line)',
  borderRadius: 10, padding: '10px 13px', fontSize: 14, color: 'var(--tx)',
  outline: 'none', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx2)', marginBottom: 6 };
const btnStyle = (busy: boolean): React.CSSProperties => ({
  width: '100%', background: 'var(--pri)', color: '#fff', border: 'none',
  borderRadius: 10, padding: '11px 0', fontSize: 14, fontWeight: 700,
  cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1,
});

function Header() {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{ width: 32, height: 32, background: 'var(--pri)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><path d="M12 2a5 5 0 1 1 0 10A5 5 0 0 1 12 2zM4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>
        </div>
        <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 18, color: 'var(--tx)' }}>SuperAdmin</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--tx2)' }}>Acesso restrito à equipe CreatorsPro</div>
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return <div style={{ fontSize: 13, color: 'var(--red)', marginBottom: 14, padding: '10px 12px', background: 'rgba(239,68,68,.08)', borderRadius: 8 }}>{msg}</div>;
}

function TotpStep({ adminId, onBack }: { adminId: string; onBack: () => void }) {
  const { verifyTotp } = usePlatform();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) { setError('Código deve ter 6 dígitos.'); return; }
    setError(''); setBusy(true);
    try {
      await verifyTotp(adminId, code);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Código inválido.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Header />
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx)', marginBottom: 4 }}>Verificação em 2 etapas</div>
        <div style={{ fontSize: 13, color: 'var(--tx2)' }}>Abra seu app autenticador e insira o código de 6 dígitos.</div>
      </div>
      <form onSubmit={submit}>
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Código TOTP</label>
          <input
            type="text" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            style={{ ...inputStyle, letterSpacing: 6, fontSize: 22, textAlign: 'center' }}
            inputMode="numeric" autoFocus autoComplete="one-time-code"
          />
        </div>
        {error && <ErrorBox msg={error} />}
        <button type="submit" disabled={busy} style={btnStyle(busy)}>{busy ? 'Verificando…' : 'Verificar'}</button>
        <button type="button" onClick={onBack} style={{ width: '100%', background: 'none', border: 'none', color: 'var(--tx2)', fontSize: 13, marginTop: 12, cursor: 'pointer' }}>← Voltar ao login</button>
      </form>
    </>
  );
}

export function PlatformLogin() {
  const { login } = usePlatform();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [totpAdminId, setTotpAdminId] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { setError('Informe e-mail e senha.'); return; }
    setError(''); setBusy(true);
    try {
      const adminId = await login(email, password);
      if (adminId) setTotpAdminId(adminId);
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
          {totpAdminId ? (
            <TotpStep adminId={totpAdminId} onBack={() => setTotpAdminId(null)} />
          ) : (
            <>
              <Header />
              <form onSubmit={submit}>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>E-mail</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} autoComplete="email" />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle}>Senha</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} autoComplete="current-password" />
                </div>
                {error && <ErrorBox msg={error} />}
                <button type="submit" disabled={busy} style={btnStyle(busy)}>{busy ? 'Entrando…' : 'Entrar'}</button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
