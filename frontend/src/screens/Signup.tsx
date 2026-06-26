import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, type PublicPlan } from '@/api';
import { ApiError } from '@/api/client';
import { Spinner } from '@/components/ui';

const inputStyle = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px', fontSize: 14, color: 'var(--tx)', outline: 'none' };

type Busy = 'trial' | 'subscribe' | null;

function fmtPlanPrice(plan: PublicPlan): string {
  const price = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: plan.currency.toUpperCase() }).format(plan.price_cents / 100);
  const suffix: Record<string, string> = { monthly: '/mês', yearly: '/ano', one_time: ' único' };
  return `${price}${suffix[plan.billing_type] ?? ''}`;
}

export function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planId = searchParams.get('plan_id') ?? undefined;
  const plano = searchParams.get('plano') ?? 'trial';
  const isTrial = plano === 'trial' || !planId;

  const [plan, setPlan] = useState<PublicPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(!!planId);

  const [companyName, setCompanyName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!planId) return;
    api.billing.publicPlans()
      .then((plans) => setPlan(plans.find((p) => p.id === planId) ?? null))
      .catch(() => setPlan(null))
      .finally(() => setPlanLoading(false));
  }, [planId]);

  // Um plano "trial" no banco é manual+price_cents=0 — não abre Stripe
  const planIsFree = plan ? (plan.price_cents === 0 || plan.billing_type === 'manual') : false;
  const canSubscribe = !!plan?.stripe_price_id && !planIsFree;

  // Quando vem de trial OU o plano é gratuito, botão primário é o trial
  const trialPrimary = isTrial || planIsFree;

  function subscribeLabel() {
    if (planLoading) return 'Carregando…';
    if (!plan || !canSubscribe) return 'Assinar agora';
    const cta = plan.billing_type === 'one_time' ? 'Adquirir' : 'Assinar';
    return `${cta} ${plan.name} — ${fmtPlanPrice(plan)}`;
  }

  function subtitle() {
    if (planLoading) return 'Carregando plano…';
    if (canSubscribe && plan) return `Você escolheu o plano ${plan.name}`;
    if (planIsFree && plan) return `Teste ${plan.name} — gratuito, sem cartão`;
    return 'Teste grátis por 4h, sem cartão — ou assine direto';
  }

  function validate(): boolean {
    if (!companyName || !adminName || !email || !password) { setError('Preencha todos os campos.'); return false; }
    if (password.length < 8) { setError('A senha precisa ter pelo menos 8 caracteres.'); return false; }
    return true;
  }

  async function submitTrial(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setError(''); setBusy('trial');
    try {
      const session = await api.billing.startTrial({ company_name: companyName, admin_name: adminName, admin_email: email, admin_password: password });
      navigate('/cadastro/trial', { state: { user: session.user } });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setError(err.message);
      else setError('Não foi possível iniciar o teste. Tente novamente.');
      setBusy(null);
    }
  }

  async function submitSubscribe() {
    if (!validate()) return;
    setError(''); setBusy('subscribe');
    try {
      const { checkout_url } = await api.billing.signup({ company_name: companyName, admin_name: adminName, admin_email: email, admin_password: password, plan_id: planId });
      window.location.href = checkout_url;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setError(err.message);
      else if (err instanceof ApiError && err.status === 400 && err.message.includes('Cobrança')) setError('Cadastro temporariamente indisponível. Tente novamente mais tarde.');
      else setError('Não foi possível iniciar o cadastro. Tente novamente.');
      setBusy(null);
    }
  }

  const btnPrimary: React.CSSProperties = { width: '100%', height: 46, borderRadius: 13, border: 'none', background: 'linear-gradient(135deg,var(--pri),var(--pri2))', color: '#fff', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 8px 22px rgba(108,99,255,.4)', marginBottom: 10 };
  const btnSecondary: React.CSSProperties = { width: '100%', height: 46, borderRadius: 13, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--tx)', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 };

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'radial-gradient(1000px 600px at 50% -10%, rgba(108,99,255,.18), transparent 60%), var(--bg0)' }}>
      <div style={{ width: 440, maxWidth: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, justifyContent: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: 'linear-gradient(135deg,var(--pri),var(--pri2))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(108,99,255,.5)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 6.9H21l-5.3 4.1 2 6.9L12 15.8 6.3 20l2-6.9L3 9h6.6L12 2z" fill="#fff" /></svg>
          </div>
          <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 24, letterSpacing: '-.02em' }}>CreatorsPro</div>
        </div>

        {/* Badge do plano selecionado */}
        {canSubscribe && plan && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pri)', background: 'rgba(108,99,255,.1)', border: '1px solid rgba(108,99,255,.25)', borderRadius: 20, padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              {plan.name} — {fmtPlanPrice(plan)}
            </div>
            <Link to="/planos" style={{ fontSize: 12, color: 'var(--tx3)', textDecoration: 'none' }}>trocar</Link>
          </div>
        )}

        <div style={{ background: 'var(--bg1)', border: '1px solid var(--line)', borderRadius: 22, padding: 30 }}>
          <div style={{ fontSize: 19, fontWeight: 700, fontFamily: "'Plus Jakarta Sans'" }}>Comece agora</div>
          <div style={{ fontSize: 13, color: 'var(--tx3)', marginTop: 4, marginBottom: 22 }}>{subtitle()}</div>

          <form onSubmit={submitTrial}>
            <label style={{ display: 'block', marginBottom: 14 }}>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx2)', marginBottom: 6 }}>Nome da empresa</span>
              <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Nome da sua empresa" style={inputStyle} />
            </label>
            <label style={{ display: 'block', marginBottom: 14 }}>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx2)', marginBottom: 6 }}>Seu nome</span>
              <input value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Seu nome completo" autoComplete="name" style={inputStyle} />
            </label>
            <label style={{ display: 'block', marginBottom: 14 }}>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx2)', marginBottom: 6 }}>E-mail</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="seuemail@empresa.com" autoComplete="email" style={inputStyle} />
            </label>
            <label style={{ display: 'block', marginBottom: 14 }}>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx2)', marginBottom: 6 }}>Senha</span>
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Mínimo 8 caracteres" autoComplete="new-password" style={inputStyle} />
            </label>

            {error && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 14 }}>{error}</div>}

            {trialPrimary ? (
              <>
                {/* Trial é primário: veio de ?plano=trial ou plano é free */}
                <button type="submit" disabled={busy !== null}
                  style={{ ...btnPrimary, cursor: busy ? 'default' : 'pointer', opacity: busy && busy !== 'trial' ? 0.6 : 1 }}>
                  {busy === 'trial' ? <Spinner /> : 'Testar 4h grátis, sem cartão'}
                </button>
                {/* Só mostra "Assinar" se há um plano pago disponível */}
                {canSubscribe && (
                  <button type="button" disabled={busy !== null} onClick={submitSubscribe}
                    style={{ ...btnSecondary, cursor: busy ? 'default' : 'pointer', opacity: busy && busy !== 'subscribe' ? 0.6 : 1 }}>
                    {busy === 'subscribe' ? <Spinner /> : subscribeLabel()}
                  </button>
                )}
              </>
            ) : (
              <>
                {/* Plano pago é primário */}
                <button type="button" disabled={busy !== null || planLoading} onClick={submitSubscribe}
                  style={{ ...btnPrimary, cursor: busy || planLoading ? 'default' : 'pointer', opacity: busy && busy !== 'subscribe' ? 0.6 : 1 }}>
                  {busy === 'subscribe' ? <Spinner /> : subscribeLabel()}
                </button>
                <button type="submit" disabled={busy !== null}
                  style={{ ...btnSecondary, cursor: busy ? 'default' : 'pointer', opacity: busy && busy !== 'trial' ? 0.6 : 1 }}>
                  {busy === 'trial' ? <Spinner /> : 'Testar 4h grátis, sem cartão'}
                </button>
              </>
            )}

            <div style={{ fontSize: 11.5, color: 'var(--tx3)', textAlign: 'center', marginTop: 12, lineHeight: 1.5 }}>
              {canSubscribe
                ? 'Você será redirecionado para o pagamento seguro — nenhuma cobrança antes da confirmação.'
                : 'No teste, depois de 4h o acesso é bloqueado até você assinar — nenhuma cobrança é feita sem você confirmar.'}
            </div>
          </form>
        </div>

        <div style={{ fontSize: 12.5, color: 'var(--tx3)', textAlign: 'center', marginTop: 18 }}>
          Já tem conta? <Link to="/login" style={{ color: 'var(--pri)', fontWeight: 600, textDecoration: 'none' }}>Entrar</Link>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--tx3)', textAlign: 'center', marginTop: 8 }}>
          <Link to="/planos" style={{ color: 'var(--tx3)', textDecoration: 'none' }}>← Ver todos os planos</Link>
        </div>
      </div>
    </div>
  );
}
