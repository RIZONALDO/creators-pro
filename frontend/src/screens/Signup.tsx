import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api';
import { ApiError } from '@/api/client';
import { Spinner } from '@/components/ui';

const inputStyle = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px', fontSize: 14, color: 'var(--tx)', outline: 'none' };

/** Cadastro público — abre o Checkout do Stripe; a empresa só é criada de fato depois do pagamento confirmar (webhook). */
export function Signup() {
  const [companyName, setCompanyName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName || !adminName || !email || !password) { setError('Preencha todos os campos.'); return; }
    if (password.length < 8) { setError('A senha precisa ter pelo menos 8 caracteres.'); return; }

    setError(''); setBusy(true);
    try {
      const { checkout_url } = await api.billing.signup({ company_name: companyName, admin_name: adminName, admin_email: email, admin_password: password });
      window.location.href = checkout_url;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setError(err.message);
      else if (err instanceof ApiError && err.status === 400 && err.message.includes('Cobrança')) setError('Cadastro temporariamente indisponível. Tente novamente mais tarde.');
      else setError('Não foi possível iniciar o cadastro. Tente novamente.');
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'radial-gradient(1000px 600px at 50% -10%, rgba(108,99,255,.18), transparent 60%), var(--bg0)' }}>
      <div style={{ width: 440, maxWidth: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, justifyContent: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: 'linear-gradient(135deg,var(--pri),var(--pri2))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(108,99,255,.5)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 6.9H21l-5.3 4.1 2 6.9L12 15.8 6.3 20l2-6.9L3 9h6.6L12 2z" fill="#fff" /></svg>
          </div>
          <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 24, letterSpacing: '-.02em' }}>CreatorsPro</div>
        </div>

        <div style={{ background: 'var(--bg1)', border: '1px solid var(--line)', borderRadius: 22, padding: 30 }}>
          <div style={{ fontSize: 19, fontWeight: 700, fontFamily: "'Plus Jakarta Sans'" }}>Comece agora</div>
          <div style={{ fontSize: 13, color: 'var(--tx3)', marginTop: 4, marginBottom: 22 }}>Crie sua conta — você será levado pro pagamento a seguir</div>

          <form onSubmit={submit}>
            <label style={{ display: 'block', marginBottom: 14 }}>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx2)', marginBottom: 6 }}>Nome da empresa</span>
              <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Studio Norte Produções" style={inputStyle} />
            </label>
            <label style={{ display: 'block', marginBottom: 14 }}>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx2)', marginBottom: 6 }}>Seu nome</span>
              <input value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Seu nome completo" autoComplete="name" style={inputStyle} />
            </label>
            <label style={{ display: 'block', marginBottom: 14 }}>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx2)', marginBottom: 6 }}>E-mail</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="voce@empresa.com" autoComplete="email" style={inputStyle} />
            </label>
            <label style={{ display: 'block', marginBottom: 14 }}>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx2)', marginBottom: 6 }}>Senha</span>
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Mínimo 8 caracteres" autoComplete="new-password" style={inputStyle} />
            </label>

            {error && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 14 }}>{error}</div>}

            <button type="submit" disabled={busy}
              style={{ width: '100%', height: 46, borderRadius: 13, border: 'none', background: 'linear-gradient(135deg,var(--pri),var(--pri2))', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 8px 22px rgba(108,99,255,.4)' }}>
              {busy ? <Spinner /> : 'Continuar para pagamento'}
            </button>
          </form>
        </div>

        <div style={{ fontSize: 12.5, color: 'var(--tx3)', textAlign: 'center', marginTop: 18 }}>
          Já tem conta? <Link to="/login" style={{ color: 'var(--pri)', fontWeight: 600, textDecoration: 'none' }}>Entrar</Link>
        </div>
      </div>
    </div>
  );
}
