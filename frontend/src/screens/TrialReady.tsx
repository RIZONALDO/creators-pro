import { useLocation, useNavigate } from 'react-router-dom';
import { Checkmark } from 'grommet-icons';
import { useApp } from '@/context/AppContext';
import type { User } from '@/types';

/** Confirmação do trial — token já foi persistido (api.billing.startTrial, chamado em
 * Signup.tsx), mas só entra no app de fato quando a pessoa clica "Começar agora" aqui (mesma
 * ideia de SignupSuccess.tsx pro pagamento: ver o que aconteceu antes de cair direto no painel).
 * Sem `location.state.user` (ex.: alguém recarregou a página) — manda pro login normal. */
export function TrialReady() {
  const location = useLocation();
  const navigate = useNavigate();
  const { enterApp } = useApp();
  const user = (location.state as { user?: User } | null)?.user;

  function start() {
    if (user) enterApp(user);
    else navigate('/login');
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'radial-gradient(1000px 600px at 50% -10%, rgba(34,197,94,.16), transparent 60%), var(--bg0)' }}>
      <div style={{ width: 420, maxWidth: '100%', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(34,197,94,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Checkmark color="#22C55E" style={{ width: 30, height: 30 }} />
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Plus Jakarta Sans'", marginBottom: 8 }}>Sua conta de teste está pronta!</div>
        <div style={{ fontSize: 13.5, color: 'var(--tx3)', lineHeight: 1.6, marginBottom: 26 }}>
          Você tem 4 horas pra explorar o CreatorsPro, sem cartão e sem compromisso. Pra continuar usando depois disso, é só assinar.
        </div>
        <button onClick={start} style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 46, padding: '0 28px',
          borderRadius: 13, border: 'none', background: 'linear-gradient(135deg,var(--pri),var(--pri2))', color: '#fff',
          fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 8px 22px rgba(108,99,255,.4)',
        }}>
          Começar agora
        </button>
      </div>
    </div>
  );
}
