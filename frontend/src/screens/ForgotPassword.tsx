import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api';
import { Spinner } from '@/components/ui';

const inputStyle = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px', fontSize: 14, color: 'var(--tx)', outline: 'none' };

/** Pública — o backend nunca revela se o e-mail existe (ver auth.service.ts#requestPasswordReset),
 * então a mensagem de sucesso é sempre a mesma, exista a conta ou não. */
export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    try {
      await api.auth.forgotPassword(email);
    } catch {
      // ignora — backend sempre devolve 204, erro aqui só seria rede/host. Mostra a mesma
      // mensagem genérica de qualquer forma (não dá pra distinguir, e não muda a ação da pessoa).
    } finally {
      setBusy(false);
      setSent(true);
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'radial-gradient(1000px 600px at 50% -10%, rgba(108,99,255,.18), transparent 60%), var(--bg0)' }}>
      <div style={{ width: 420, maxWidth: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, justifyContent: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: 'linear-gradient(135deg,var(--pri),var(--pri2))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(108,99,255,.5)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 6.9H21l-5.3 4.1 2 6.9L12 15.8 6.3 20l2-6.9L3 9h6.6L12 2z" fill="#fff" /></svg>
          </div>
          <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 24, letterSpacing: '-.02em' }}>CreatorsPro</div>
        </div>

        <div style={{ background: 'var(--bg1)', border: '1px solid var(--line)', borderRadius: 22, padding: 30 }}>
          {sent ? (
            <>
              <div style={{ fontSize: 19, fontWeight: 700, fontFamily: "'Plus Jakarta Sans'", marginBottom: 8 }}>Verifique seu e-mail</div>
              <div style={{ fontSize: 13.5, color: 'var(--tx2)', lineHeight: 1.5 }}>
                Se <strong>{email}</strong> tiver uma conta aqui, você vai receber um link pra redefinir a senha em alguns minutos. O link vale por 1 hora.
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 19, fontWeight: 700, fontFamily: "'Plus Jakarta Sans'" }}>Esqueceu sua senha?</div>
              <div style={{ fontSize: 13, color: 'var(--tx3)', marginTop: 4, marginBottom: 22 }}>Informe seu e-mail e mandamos um link pra redefinir</div>

              <form onSubmit={submit}>
                <label style={{ display: 'block', marginBottom: 18 }}>
                  <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx2)', marginBottom: 6 }}>E-mail</span>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="voce@empresa.com" autoComplete="email" autoFocus style={inputStyle} />
                </label>

                <button type="submit" disabled={busy}
                  style={{ width: '100%', height: 46, borderRadius: 13, border: 'none', background: 'linear-gradient(135deg,var(--pri),var(--pri2))', color: '#fff', fontWeight: 700, fontSize: 14, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 8px 22px rgba(108,99,255,.4)' }}>
                  {busy ? <Spinner /> : 'Enviar link de redefinição'}
                </button>
              </form>
            </>
          )}
        </div>

        <div style={{ fontSize: 12.5, color: 'var(--tx3)', textAlign: 'center', marginTop: 18 }}>
          <Link to="/login" style={{ color: 'var(--pri)', fontWeight: 600, textDecoration: 'none' }}>← Voltar pro login</Link>
        </div>
      </div>
    </div>
  );
}
