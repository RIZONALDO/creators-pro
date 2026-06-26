import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '@/api';
import { useApp } from '@/context/AppContext';
import { ApiError } from '@/api/client';
import { Spinner } from '@/components/ui';

const inputStyle = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px', fontSize: 14, color: 'var(--tx)', outline: 'none' };

interface BlockedInfo { code: string; email: string; message: string }

/** Pública — token vem do link do e-mail (ver auth.service.ts#requestPasswordReset). Sucesso já
 * loga automaticamente (resetPassword no AppContext seta o user — App.tsx redireciona sozinho).
 *
 * TRIAL_EXPIRED/SUBSCRIPTION_INACTIVE são um caso especial: a senha JÁ foi trocada de verdade no
 * backend antes desse erro (ver auth.service.ts#resetPassword) — bloqueado é a sessão, não a
 * redefinição. Por isso não reaproveita a mensagem genérica de erro: mostra que funcionou e guia
 * pro próximo passo (mesma mecânica de Login.tsx#upgrade pro caso de trial vencido). */
export function ResetPassword() {
  const { token } = useParams<{ token: string }>();
  const { resetPassword } = useApp();
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState<BlockedInfo | null>(null);
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [upgradeLabel, setUpgradeLabel] = useState('Assinar agora');

  useEffect(() => {
    api.billing.publicPlans().then((plans) => {
      const paid = plans.find((p) => p.stripe_price_id && p.price_cents > 0);
      if (!paid) return;
      const val = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: paid.currency.toUpperCase() }).format(paid.price_cents / 100);
      const period = paid.billing_type === 'yearly' ? '/ano' : paid.billing_type === 'monthly' ? '/mês' : '';
      setUpgradeLabel(`Assinar agora — ${val}${period}`);
    }).catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError('A senha precisa ter pelo menos 8 caracteres.'); return; }
    if (password !== password2) { setError('As senhas não coincidem.'); return; }
    setError(''); setBusy(true);
    try {
      await resetPassword(token!, password);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVALID_RESET_TOKEN') {
        setError('Esse link expirou ou já foi usado. Solicite um novo.');
      } else if (err instanceof ApiError && err.details?.password_changed && typeof err.details.email === 'string') {
        setBlocked({ code: err.code ?? '', email: err.details.email, message: err.message });
      } else {
        setError('Não foi possível redefinir a senha. Tente novamente.');
      }
      setBusy(false);
    }
  }

  async function upgrade() {
    if (!blocked) return;
    setUpgradeBusy(true);
    try {
      const { checkout_url } = await api.billing.upgradeTrial(blocked.email, password);
      window.location.href = checkout_url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível iniciar a assinatura. Tente novamente.');
      setUpgradeBusy(false);
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
          {blocked ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 19, fontWeight: 700, fontFamily: "'Plus Jakarta Sans'", color: 'var(--green)', marginBottom: 8 }}>
                Senha redefinida ✓
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--tx2)', lineHeight: 1.5, marginBottom: 20 }}>
                {blocked.message}
              </div>

              {blocked.code === 'TRIAL_EXPIRED' ? (
                <button onClick={upgrade} disabled={upgradeBusy}
                  style={{ width: '100%', height: 46, borderRadius: 13, border: 'none', background: 'linear-gradient(135deg,var(--pri),var(--pri2))', color: '#fff', fontWeight: 700, fontSize: 14, cursor: upgradeBusy ? 'default' : 'pointer', opacity: upgradeBusy ? 0.75 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 8px 22px rgba(108,99,255,.4)' }}>
                  {upgradeBusy ? <Spinner /> : upgradeLabel}
                </button>
              ) : (
                <div style={{ fontSize: 12.5, color: 'var(--tx3)' }}>
                  Use sua senha nova quando a assinatura voltar a ficar ativa.
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: 19, fontWeight: 700, fontFamily: "'Plus Jakarta Sans'" }}>Nova senha</div>
              <div style={{ fontSize: 13, color: 'var(--tx3)', marginTop: 4, marginBottom: 22 }}>Escolha uma senha nova pra sua conta</div>

              <form onSubmit={submit}>
                <label style={{ display: 'block', marginBottom: 14 }}>
                  <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx2)', marginBottom: 6 }}>Nova senha</span>
                  <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Mínimo 8 caracteres" autoComplete="new-password" autoFocus style={inputStyle} />
                </label>
                <label style={{ display: 'block', marginBottom: 14 }}>
                  <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx2)', marginBottom: 6 }}>Confirmar nova senha</span>
                  <input value={password2} onChange={(e) => setPassword2(e.target.value)} type="password" placeholder="Repita a senha" autoComplete="new-password" style={inputStyle} />
                </label>

                {error && (
                  <div style={{ fontSize: 12.5, color: 'var(--red)', marginBottom: 14 }}>
                    {error}
                    {error.includes('expirou') && <> <Link to="/esqueci-senha" style={{ color: 'var(--pri)', fontWeight: 600, textDecoration: 'none' }}>Solicitar novo link</Link></>}
                  </div>
                )}

                <button type="submit" disabled={busy}
                  style={{ width: '100%', height: 46, borderRadius: 13, border: 'none', background: 'linear-gradient(135deg,var(--pri),var(--pri2))', color: '#fff', fontWeight: 700, fontSize: 14, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 8px 22px rgba(108,99,255,.4)' }}>
                  {busy ? <Spinner /> : 'Redefinir senha'}
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
