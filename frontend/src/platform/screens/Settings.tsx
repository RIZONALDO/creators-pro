import { useState } from 'react';
import { platformApi } from '../api';
import { usePlatform } from '../context/PlatformContext';

function TotpSetup({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<'idle' | 'qr' | 'done'>('idle');
  const [qrData, setQrData] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function startSetup() {
    setBusy(true); setError('');
    try {
      const data = await platformApi.auth.setupTotp();
      setQrData(data);
      setStep('qr');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao iniciar configuração.');
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!qrData || code.length !== 6) { setError('Código deve ter 6 dígitos.'); return; }
    setBusy(true); setError('');
    try {
      await platformApi.auth.confirmTotp(qrData.secret, code);
      setStep('done');
      onDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Código inválido.');
    } finally {
      setBusy(false);
    }
  }

  const inp: React.CSSProperties = { background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '9px 13px', fontSize: 14, color: 'var(--tx)', outline: 'none' };

  if (step === 'idle') {
    return (
      <div style={{ marginTop: 16 }}>
        <button onClick={startSetup} disabled={busy} style={{ background: 'var(--pri)', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>
          {busy ? 'Gerando QR Code…' : 'Configurar 2FA agora'}
        </button>
        {error && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{error}</div>}
      </div>
    );
  }

  if (step === 'qr' && qrData) {
    return (
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--tx2)', marginBottom: 14 }}>
          Escaneie o QR Code com o Google Authenticator, Authy ou qualquer app TOTP:
        </div>
        <img src={qrData.qrDataUrl} alt="QR Code 2FA" style={{ width: 180, height: 180, borderRadius: 12, border: '1px solid var(--line)', display: 'block', marginBottom: 16 }} />
        <div style={{ fontSize: 12, color: 'var(--tx3)', marginBottom: 16 }}>
          Chave manual: <code style={{ background: 'var(--bg3)', padding: '2px 6px', borderRadius: 5, fontSize: 12 }}>{qrData.secret}</code>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} style={{ ...inp, width: 140, letterSpacing: 4, textAlign: 'center', fontSize: 18 }} inputMode="numeric" placeholder="000000" autoComplete="one-time-code" />
          <button onClick={confirm} disabled={busy} style={{ background: 'var(--pri)', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Confirmar</button>
        </div>
        {error && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{error}</div>}
      </div>
    );
  }

  if (step === 'done') {
    return <div style={{ marginTop: 12, fontSize: 14, color: '#16a34a', fontWeight: 600 }}>✓ 2FA configurado com sucesso!</div>;
  }

  return null;
}

function TotpDisable({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  async function disable() {
    if (code.length !== 6) { setError('Código deve ter 6 dígitos.'); return; }
    setBusy(true); setError('');
    try {
      await platformApi.auth.disableTotp(code);
      onDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Código inválido.');
    } finally {
      setBusy(false);
    }
  }

  if (!show) {
    return <button onClick={() => setShow(true)} style={{ background: 'none', border: '1px solid var(--line)', color: 'var(--red)', borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer', marginTop: 12 }}>Desativar 2FA</button>;
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 13, color: 'var(--tx2)', marginBottom: 10 }}>Para confirmar, insira o código do seu app autenticador:</div>
      <div style={{ display: 'flex', gap: 10 }}>
        <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '9px 13px', fontSize: 14, color: 'var(--tx)', outline: 'none', width: 130, letterSpacing: 4, textAlign: 'center' }} inputMode="numeric" placeholder="000000" />
        <button onClick={disable} disabled={busy} style={{ background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          {busy ? '…' : 'Desativar'}
        </button>
        <button onClick={() => setShow(false)} style={{ background: 'none', border: '1px solid var(--line)', color: 'var(--tx2)', borderRadius: 10, padding: '9px 14px', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
      </div>
      {error && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 8 }}>{error}</div>}
    </div>
  );
}

export function Settings() {
  const { admin } = usePlatform();
  const [totpEnabled, setTotpEnabled] = useState(admin?.totp_enabled ?? false);

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--tx)', fontFamily: "'Plus Jakarta Sans'", marginBottom: 28 }}>Configurações</div>

      <div style={{ background: 'var(--bg1)', border: '1px solid var(--line)', borderRadius: 16, padding: 24, maxWidth: 560 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--tx)', marginBottom: 4 }}>Autenticação em 2 etapas (TOTP)</div>
        <div style={{ fontSize: 13, color: 'var(--tx2)', marginBottom: 16 }}>
          {totpEnabled
            ? 'O 2FA está ativo. Você precisará do código TOTP a cada login.'
            : 'Adicione uma camada extra de segurança à sua conta de superadmin.'}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 20, borderRadius: 10, background: totpEnabled ? 'var(--pri)' : 'var(--bg3)',
            border: `1px solid ${totpEnabled ? 'var(--pri)' : 'var(--line)'}`, position: 'relative', transition: 'background .2s',
          }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: totpEnabled ? 18 : 2, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: totpEnabled ? 'var(--pri)' : 'var(--tx2)' }}>
            {totpEnabled ? 'Ativo' : 'Inativo'}
          </span>
        </div>

        {!totpEnabled ? (
          <TotpSetup onDone={() => setTotpEnabled(true)} />
        ) : (
          <TotpDisable onDone={() => setTotpEnabled(false)} />
        )}
      </div>
    </div>
  );
}
