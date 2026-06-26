import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert } from 'grommet-icons';
import { useApp } from '@/context/AppContext';
import { ApiError } from '@/api/client';
import { isGoogleSignInConfigured, renderGoogleSignInButton } from '@/lib/googleIdentity';

/** Única forma de ativar uma conta criada só com e-mail (Cadastros, sem senha) — o link
 * (/convite/:token) só chega a quem o gestor de fato compartilhar; o botão de login comum nunca
 * ativa essa conta (ver backend auth.service.ts#loginWithGoogle pro porquê disso ser importante). */
export function ClaimInvite() {
  const { token } = useParams<{ token: string }>();
  const { claimInvite } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const googleButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token || !isGoogleSignInConfigured() || !googleButtonRef.current) return;
    let cancelled = false;
    renderGoogleSignInButton(googleButtonRef.current, async (idToken) => {
      setError(''); setBusy(true);
      try {
        await claimInvite(token, idToken);
      } catch (err) {
        if (err instanceof ApiError && err.status === 402) setError(err.message); // assinatura suspensa/cancelada
        else if (!(err instanceof ApiError)) setError('Não foi possível conectar ao servidor. Verifique a rede/Wi-Fi.');
        else setError(err.message);
      } finally {
        setBusy(false);
      }
    }, () => cancelled).catch(() => { if (!cancelled) setError('Não foi possível carregar o login com Google.'); });
    return () => { cancelled = true; };
  }, [token, claimInvite]);

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
          <div style={{ fontSize: 19, fontWeight: 700, fontFamily: "'Plus Jakarta Sans'" }}>Você foi convidado</div>
          <div style={{ fontSize: 13, color: 'var(--tx3)', marginTop: 4, marginBottom: 22 }}>
            Entre com a conta Google do mesmo e-mail que recebeu este convite pra ativar seu acesso.
          </div>

          {!token && (
            <div style={{ fontSize: 12.5, color: 'var(--red)' }}>Link de convite inválido — falta o código. Peça um novo link a quem te cadastrou.</div>
          )}

          {token && !isGoogleSignInConfigured() && (
            <div style={{ fontSize: 12.5, color: 'var(--red)' }}>Login com Google não está disponível neste momento. Peça pra quem te cadastrou tentar de outra forma.</div>
          )}

          {token && isGoogleSignInConfigured() && (
            <>
              {busy && <div style={{ fontSize: 12.5, color: 'var(--tx3)', marginBottom: 12 }}>Confirmando…</div>}
              {error && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: 'var(--red)', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 11, padding: '10px 12px', marginBottom: 16 }}>
                  <Alert color="currentColor" size="small" style={{ flex: 'none', marginTop: 1 }} />
                  <span>{error}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'center', minHeight: 40 }}>
                <div ref={googleButtonRef} />
              </div>
            </>
          )}
        </div>

        <div style={{ fontSize: 12.5, color: 'var(--tx3)', textAlign: 'center', marginTop: 18 }}>
          Já ativou seu acesso? <Link to="/login" style={{ color: 'var(--pri)', fontWeight: 600, textDecoration: 'none' }}>Entrar</Link>
        </div>
      </div>
    </div>
  );
}
