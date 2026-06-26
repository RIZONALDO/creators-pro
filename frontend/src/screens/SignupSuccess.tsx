import { Link } from 'react-router-dom';
import { Checkmark } from 'grommet-icons';

/** Stripe redireciona pra aqui depois do pagamento — a empresa/admin já foram criados pelo webhook (quase instantâneo, mas não síncrono com este redirect). */
export function SignupSuccess() {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'radial-gradient(1000px 600px at 50% -10%, rgba(34,197,94,.16), transparent 60%), var(--bg0)' }}>
      <div style={{ width: 420, maxWidth: '100%', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(34,197,94,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Checkmark color="#22C55E" style={{ width: 30, height: 30 }} />
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Plus Jakarta Sans'", marginBottom: 8 }}>Pagamento confirmado!</div>
        <div style={{ fontSize: 13.5, color: 'var(--tx3)', lineHeight: 1.6, marginBottom: 26 }}>
          Sua conta está sendo preparada — isso leva só alguns instantes. Entre com o e-mail e a senha que você cadastrou.
        </div>
        <Link to="/login" style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 46, padding: '0 28px',
          borderRadius: 13, border: 'none', background: 'linear-gradient(135deg,var(--pri),var(--pri2))', color: '#fff',
          fontWeight: 700, fontSize: 14, textDecoration: 'none', boxShadow: '0 8px 22px rgba(108,99,255,.4)',
        }}>
          Ir para o login
        </Link>
      </div>
    </div>
  );
}
