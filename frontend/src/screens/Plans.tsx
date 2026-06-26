import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { StatusGood } from 'grommet-icons';
import { api, type PublicPlan } from '@/api';

const BILLING_NOTE: Record<string, string> = { monthly: 'por mês', yearly: 'por ano', one_time: 'pagamento único', manual: '' };

function fmtPrice(plan: PublicPlan): { main: string; note: string } {
  if (plan.price_cents === 0 || plan.billing_type === 'manual') return { main: 'Grátis', note: '' };
  const value = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: plan.currency.toUpperCase() }).format(plan.price_cents / 100);
  return { main: value, note: BILLING_NOTE[plan.billing_type] ?? '' };
}

function planFeatures(plan: PublicPlan): string[] {
  const feats: string[] = [];
  if (plan.max_gestores != null) feats.push(`Até ${plan.max_gestores} gestor${plan.max_gestores !== 1 ? 'es' : ''}`);
  if (plan.max_creators != null) feats.push(`Até ${plan.max_creators} creator${plan.max_creators !== 1 ? 's' : ''}`);
  feats.push('Tarefas, escala e plantões', 'Relatórios e indicadores', 'App mobile (PWA)');
  if (plan.price_cents === 0 || plan.billing_type === 'manual') feats.push('Sem precisar de cartão');
  return feats;
}

/** Landing de planos — busca os planos ativos do banco via /plans/public.
 * Único lugar do app com licença pra "vender" — aqui cabe, é propaganda. */
export function Plans() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<PublicPlan[] | null>(null);

  useEffect(() => {
    api.billing.publicPlans().then(setPlans).catch(() => setPlans([]));
  }, []);

  // O primeiro plano pago (com Stripe) recebe o badge "Mais escolhido"
  const firstPaidIdx = plans?.findIndex((p) => p.stripe_price_id) ?? -1;

  return (
    <div style={{ minHeight: '100dvh', background: 'radial-gradient(1100px 650px at 50% -10%, rgba(108,99,255,.22), transparent 60%), var(--bg0)', padding: '48px 24px 64px' }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, justifyContent: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: 'linear-gradient(135deg,var(--pri),var(--pri2))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(108,99,255,.5)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 6.9H21l-5.3 4.1 2 6.9L12 15.8 6.3 20l2-6.9L3 9h6.6L12 2z" fill="#fff" /></svg>
          </div>
          <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 24, letterSpacing: '-.02em' }}>CreatorsPro</div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 34, letterSpacing: '-.02em', lineHeight: 1.15, marginBottom: 12 }}>
            Sua agência de creators, sem planilha
          </div>
          <div style={{ fontSize: 15, color: 'var(--tx2)', maxWidth: 520, margin: '0 auto' }}>
            Tarefas, escala, plantões e ausências num só painel. Escolha como quer começar.
          </div>
        </div>

        {plans === null && (
          <div style={{ textAlign: 'center', color: 'var(--tx3)', fontSize: 14 }}>Carregando planos…</div>
        )}

        {plans !== null && plans.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--tx3)', fontSize: 14, padding: 40 }}>
            Planos em breve. <Link to="/cadastro?plano=trial" style={{ color: 'var(--pri)', fontWeight: 600, textDecoration: 'none' }}>Comece com o teste grátis →</Link>
          </div>
        )}

        {plans !== null && plans.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 22, maxWidth: Math.min(plans.length * 340, 980), margin: '0 auto' }}>
            {plans.map((plan, idx) => {
              const { main, note } = fmtPrice(plan);
              const isFree = plan.price_cents === 0 || plan.billing_type === 'manual';
              const canPay = !!plan.stripe_price_id;
              const highlighted = idx === firstPaidIdx;
              return (
                <PlanCard
                  key={plan.id}
                  name={plan.name}
                  price={main}
                  priceNote={note}
                  cta={isFree ? 'Testar agora' : canPay ? (plan.billing_type === 'one_time' ? 'Adquirir agora' : 'Assinar agora') : 'Entre em contato'}
                  highlighted={highlighted}
                  footnote={plan.billing_type === 'monthly' ? 'Cancele quando quiser' : undefined}
                  features={planFeatures(plan)}
                  onSelect={() => {
                    if (isFree) navigate('/cadastro?plano=trial');
                    else if (canPay) navigate(`/cadastro?plano=pro&plan_id=${plan.id}`);
                    else navigate('/cadastro?plano=trial');
                  }}
                />
              );
            })}
          </div>
        )}

        <div style={{ fontSize: 12.5, color: 'var(--tx3)', textAlign: 'center', marginTop: 36 }}>
          Já tem conta? <Link to="/login" style={{ color: 'var(--pri)', fontWeight: 600, textDecoration: 'none' }}>Entrar</Link>
        </div>
      </div>
    </div>
  );
}

function PlanCard({ name, price, priceNote, cta, onSelect, highlighted, footnote, features }: {
  name: string; price: string; priceNote: string; cta: string; onSelect: () => void;
  highlighted?: boolean; footnote?: string; features: string[];
}) {
  return (
    <div style={{
      position: 'relative', display: 'flex', flexDirection: 'column',
      background: highlighted ? 'linear-gradient(160deg, rgba(108,99,255,.14), var(--bg1))' : 'var(--bg1)',
      border: highlighted ? '1.5px solid var(--pri)' : '1px solid var(--line)',
      borderRadius: 22, padding: 30,
      boxShadow: highlighted ? '0 16px 40px rgba(108,99,255,.25)' : 'none',
    }}>
      {highlighted && (
        <div style={{
          position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#fff',
          background: 'linear-gradient(135deg,var(--pri),var(--pri2))', padding: '5px 14px', borderRadius: 20,
          boxShadow: '0 6px 16px rgba(108,99,255,.45)', whiteSpace: 'nowrap',
        }}>
          ★ Mais escolhido
        </div>
      )}

      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx2)', marginTop: highlighted ? 6 : 0 }}>{name}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 10, marginBottom: 2 }}>
        <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 36, letterSpacing: '-.02em' }}>{price}</span>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--tx3)', marginBottom: 22 }}>{priceNote}</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 26, flex: 1 }}>
        {features.map((f) => (
          <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13, color: 'var(--tx2)' }}>
            <StatusGood color="var(--pri)" size="16px" style={{ flex: 'none', marginTop: 1 }} />
            <span>{f}</span>
          </div>
        ))}
      </div>

      <button onClick={onSelect} style={{
        width: '100%', height: 48, borderRadius: 13, border: highlighted ? 'none' : '1px solid var(--line2)',
        background: highlighted ? 'linear-gradient(135deg,var(--pri),var(--pri2))' : 'var(--bg2)',
        color: highlighted ? '#fff' : 'var(--tx)', fontWeight: 700, fontSize: 14, cursor: 'pointer',
        boxShadow: highlighted ? '0 10px 26px rgba(108,99,255,.4)' : 'none',
      }}>
        {cta}
      </button>
      {footnote && <div style={{ fontSize: 11.5, color: 'var(--tx3)', textAlign: 'center', marginTop: 10 }}>{footnote}</div>}
    </div>
  );
}
