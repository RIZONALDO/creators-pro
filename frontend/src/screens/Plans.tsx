import { Link, useNavigate } from 'react-router-dom';
import { StatusGood, Trophy } from 'grommet-icons';

const FEATURES = [
  'Até 3 gestores',
  'Até 8 creators e colaboradores',
  'Tarefas, escala e plantões sem planilha',
  'Relatórios e indicadores de produção',
  'Mensagens internas com a equipe',
  'App mobile (PWA) pra creators e colaboradores',
];

/** Landing de planos — passo novo entre Login e Signup.tsx. Único lugar do app com licença pra
 * "vender" (o resto do produto evita apelo visual de propósito) — aqui ele cabe: é propaganda. */
export function Plans() {
  const navigate = useNavigate();

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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 22, maxWidth: 720, margin: '0 auto' }}>
          <PlanCard
            name="Teste grátis"
            price="Grátis"
            priceNote="por 4 horas, sem cartão"
            cta="Testar agora"
            onSelect={() => navigate('/cadastro?plano=trial')}
          />
          <PlanCard
            name="Pro"
            price="R$ 199,90"
            priceNote="por mês"
            cta="Assinar agora"
            highlighted
            footnote="Cancele quando quiser"
            onSelect={() => navigate('/cadastro?plano=pro')}
          />
        </div>

        <div style={{ fontSize: 12.5, color: 'var(--tx3)', textAlign: 'center', marginTop: 36 }}>
          Já tem conta? <Link to="/login" style={{ color: 'var(--pri)', fontWeight: 600, textDecoration: 'none' }}>Entrar</Link>
        </div>
      </div>
    </div>
  );
}

function PlanCard({ name, price, priceNote, cta, onSelect, highlighted, footnote }: {
  name: string; price: string; priceNote: string; cta: string; onSelect: () => void; highlighted?: boolean; footnote?: string;
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
          <Trophy color="#fff" size="13px" /> Mais escolhido
        </div>
      )}

      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx2)', marginTop: highlighted ? 6 : 0 }}>{name}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 10, marginBottom: 2 }}>
        <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 36, letterSpacing: '-.02em' }}>{price}</span>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--tx3)', marginBottom: 22 }}>{priceNote}</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 26, flex: 1 }}>
        {FEATURES.map((f) => (
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
