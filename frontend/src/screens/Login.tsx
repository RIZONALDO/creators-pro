import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Tasks, Schedule, Shift } from 'grommet-icons';
import { useApp } from '@/context/AppContext';
import { Spinner } from '@/components/ui';
import { PasswordInput } from '@/components/PasswordInput';
import { api } from '@/api';
import { ApiError } from '@/api/client';
import { isGoogleSignInConfigured, renderGoogleSignInButton } from '@/lib/googleIdentity';

const REMEMBER_KEY = 'cp_remember_email';

// font-size/padding/border-radius ficam na classe .cp-auth-input (theme.css) — 16px de propósito,
// evita o zoom automático do Safari/Chrome no iOS ao focar o campo.
const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg2)', border: '1px solid var(--line)', color: 'var(--tx)', outline: 'none',
};

const FEATURES = [
  { icon: Tasks, text: 'Tarefas e produção de conteúdo num só lugar' },
  { icon: Schedule, text: 'Escala dos creators, sem planilha' },
  { icon: Shift, text: 'Plantões e ausências com aprovação rápida' },
];

export function Login() {
  const { login, loginWithGoogle, theme, toggleTheme } = useApp();
  const [email, setEmail] = useState(() => localStorage.getItem(REMEMBER_KEY) ?? '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(() => localStorage.getItem(REMEMBER_KEY) !== null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Trial vencido OU assinatura suspensa/cancelada (os dois 402) têm o mesmo caminho de
  // recuperação: assinar de novo com as mesmas credenciais já digitadas (ver
  // billing.service.ts#upgradeTrial — mesmo endpoint reativa os dois casos, mantendo a empresa e
  // os dados que já existiam). Sem isso, quem cancelava ficava sem nenhuma indicação ou caminho de
  // volta — só uma mensagem de bloqueio sem ação possível.
  const [canReactivate, setCanReactivate] = useState(false);
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);

  // Mesma classificação de erro do submit() por senha — reaproveitada pelos dois fluxos.
  function describeAuthError(err: unknown): string {
    if (err instanceof ApiError && err.status === 402) return err.message; // assinatura suspensa/cancelada/trial vencido (Fase 9.1)
    if (!(err instanceof ApiError)) return 'Não foi possível conectar ao servidor. Verifique a rede/Wi-Fi.';
    return err.message;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { setError('Informe e-mail e senha.'); return; }
    setError(''); setCanReactivate(false); setBusy(true);
    try {
      await login(email, password);
      if (remember) localStorage.setItem(REMEMBER_KEY, email);
      else localStorage.removeItem(REMEMBER_KEY);
    }
    catch (err) {
      // não é ApiError == fetchWithFallback nem chegou a receber resposta HTTP (todos os hosts
      // candidatos falharam) — é rede/host, não senha errada. Misturar os dois confundiu mais de
      // uma vez ao testar pelo IP de LAN (celular): a mensagem de "credenciais" escondia que era
      // só o IP do .env desatualizado.
      if (err instanceof ApiError && err.status !== 402) setError('Não foi possível entrar. Verifique as credenciais.');
      else {
        setError(describeAuthError(err));
        if (err instanceof ApiError && (err.code === 'TRIAL_EXPIRED' || err.code === 'SUBSCRIPTION_INACTIVE')) setCanReactivate(true);
      }
    }
    finally { setBusy(false); }
  }

  async function upgrade() {
    setUpgradeBusy(true);
    try {
      const { checkout_url } = await api.billing.upgradeTrial(email, password);
      window.location.href = checkout_url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível iniciar a assinatura. Tente novamente.');
      setUpgradeBusy(false);
    }
  }

  // Desenha o botão oficial do Google só se houver client id configurado (mesmo padrão opcional de
  // VAPID/Stripe) — sem isso, a tela de login não muda em nada pra quem não configurou.
  useEffect(() => {
    if (!isGoogleSignInConfigured() || !googleButtonRef.current) return;
    let cancelled = false;
    renderGoogleSignInButton(googleButtonRef.current, async (idToken) => {
      setError(''); setBusy(true);
      try {
        await loginWithGoogle(idToken);
      } catch (err) {
        setError(describeAuthError(err));
      } finally {
        setBusy(false);
      }
    }, () => cancelled).catch(() => { if (!cancelled) setError('Não foi possível carregar o login com Google.'); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="cp-auth-page">
      <button onClick={toggleTheme} title="Alternar tema" style={{
        position: 'fixed', top: 'calc(16px + env(safe-area-inset-top, 0px))', right: 16, zIndex: 10,
        width: 38, height: 38, borderRadius: 11, background: 'var(--bg2)', border: '1px solid var(--line)',
        color: 'var(--tx2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {theme === 'dark'
          ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></svg>
          : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>}
      </button>

      {/* Painel de marca — só em telas largas (>=900px), oculto no mobile pra ir direto ao formulário. */}
      <div className="cp-auth-brand" style={{
        alignItems: 'center', justifyContent: 'center', padding: 48,
        background: 'radial-gradient(900px 700px at 20% 10%, rgba(108,99,255,.22), transparent 60%), var(--bg1)',
        borderRight: '1px solid var(--line)',
      }}>
        <div style={{ maxWidth: 420 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 26 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, flex: 'none', background: 'linear-gradient(135deg,var(--pri),var(--pri2))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(108,99,255,.5)' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 6.9H21l-5.3 4.1 2 6.9L12 15.8 6.3 20l2-6.9L3 9h6.6L12 2z" fill="#fff" /></svg>
            </div>
            <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 26, letterSpacing: '-.02em' }}>CreatorsPro</div>
          </div>
          <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 30, lineHeight: 1.25, marginBottom: 14 }}>
            Gerencie sua agência de creators num só lugar
          </div>
          <div style={{ fontSize: 14.5, color: 'var(--tx2)', lineHeight: 1.5, marginBottom: 30 }}>
            Tarefas, escala, plantões e ausências — tudo num painel pensado pra coordenação do dia a dia.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, flex: 'none', borderRadius: 10, background: 'rgba(108,99,255,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--pri2)' }}>
                  <Icon color="currentColor" size="17px" />
                </div>
                <span style={{ fontSize: 13.5, color: 'var(--tx2)' }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Formulário — sempre visível, tela toda no mobile, painel direito a partir de 900px. */}
      <div className="cp-auth-form-panel">
        <div style={{ width: 420, maxWidth: '100%' }}>
          {/* Logo compacto: só aparece quando o painel de marca está oculto (mobile/tablet estreito) —
            * por isso pode ser bem maior aqui sem afetar o desktop (lá fica display:none). */}
          <div className="cp-auth-brand-compact" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginBottom: 36 }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(135deg,var(--pri),var(--pri2))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 28px rgba(108,99,255,.5)' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 6.9H21l-5.3 4.1 2 6.9L12 15.8 6.3 20l2-6.9L3 9h6.6L12 2z" fill="#fff" /></svg>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 24, letterSpacing: '-.02em' }}>CreatorsPro</div>
              <div style={{ fontSize: 13.5, color: 'var(--tx3)', marginTop: 4 }}>Bem-vindo de volta</div>
            </div>
          </div>

          <div className="cp-auth-card">
            <div className="cp-auth-card-title" style={{ fontSize: 19, fontWeight: 700, fontFamily: "'Plus Jakarta Sans'" }}>Acesse o painel</div>
            <div className="cp-auth-card-title" style={{ fontSize: 13, color: 'var(--tx3)', marginTop: 4, marginBottom: 22 }}>Entre com sua conta CreatorsPro</div>

            <form onSubmit={submit}>
              <label style={{ display: 'block', marginBottom: 14 }}>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx2)', marginBottom: 6 }}>E-mail</span>
                <input
                  value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com"
                  type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" autoComplete="username"
                  autoFocus enterKeyHint="next" className="cp-auth-input" style={inputStyle}
                />
              </label>
              <label style={{ display: 'block', marginBottom: 14 }}>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx2)', marginBottom: 6 }}>Senha</span>
                <PasswordInput
                  value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                  autoComplete="current-password" enterKeyHint="go" className="cp-auth-input" style={inputStyle}
                />
              </label>

              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ width: 15, height: 15, accentColor: 'var(--pri)' }} />
                  <span style={{ fontSize: 12.5, color: 'var(--tx2)' }}>Lembrar-me</span>
                </label>
                <Link to="/esqueci-senha" style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--pri)', fontWeight: 600, textDecoration: 'none' }}>Esqueci a senha</Link>
              </div>

              {error && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: 'var(--red)', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 11, padding: '10px 12px', marginBottom: 16 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flex: 'none', marginTop: 1 }}><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
                  <span>{error}</span>
                </div>
              )}

              {canReactivate ? (
                <button type="button" disabled={upgradeBusy} onClick={upgrade}
                  style={{ width: '100%', height: 46, borderRadius: 13, border: 'none', background: 'linear-gradient(135deg,var(--pri),var(--pri2))', color: '#fff', fontWeight: 700, fontSize: 14, cursor: upgradeBusy ? 'default' : 'pointer', opacity: upgradeBusy ? 0.75 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 8px 22px rgba(108,99,255,.4)' }}>
                  {upgradeBusy ? <Spinner /> : 'Assinar agora — R$ 199,90/mês'}
                </button>
              ) : (
                <button type="submit" disabled={busy}
                  style={{ width: '100%', height: 46, borderRadius: 13, border: 'none', background: 'linear-gradient(135deg,var(--pri),var(--pri2))', color: '#fff', fontWeight: 700, fontSize: 14, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.75 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 8px 22px rgba(108,99,255,.4)' }}>
                  {busy ? <Spinner /> : 'Entrar'}
                </button>
              )}
            </form>

            {/* Visível também no PWA (não só desktop) — é exatamente o login mais fácil pra
              * operacional no celular: 1 toque, sem digitar senha. Não desenha nada (nem o
              * separador "ou") quando VITE_GOOGLE_CLIENT_ID não está configurado. */}
            {isGoogleSignInConfigured() && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0' }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                  <span style={{ fontSize: 11.5, color: 'var(--tx3)' }}>ou</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                </div>
                {/* Botão padrão do Google, sem customização (tema/tamanho/formato escolhidos pelo
                  * próprio Google) — só sem largura forçada no ref (senão ele estica pra largura do
                  * form em vez do tamanho natural dele). minHeight reserva o espaço do botão (40px,
                  * tamanho padrão) desde já — sem isso, a área nasce com altura 0 e "salta"/expande
                  * de repente quando o script do Google termina de carregar e desenha o botão. */}
                <div style={{ display: 'flex', justifyContent: 'center', minHeight: 40 }}>
                  <div ref={googleButtonRef} />
                </div>
              </>
            )}

          </div>

          <div className="cp-auth-desktop-only" style={{ fontSize: 12.5, color: 'var(--tx3)', textAlign: 'center', marginTop: 18 }}>
            Ainda não tem conta? <Link to="/planos" style={{ color: 'var(--pri)', fontWeight: 600, textDecoration: 'none' }}>Assine o CreatorsPro</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
