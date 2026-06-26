import { useEffect, useState } from 'react';
import { Notification } from 'grommet-icons';
import { useToast } from '@/context/ToastContext';
import { isPushSupported, getCurrentPushSubscription, enablePush, disablePush } from '@/lib/push';

type Status = 'loading' | 'on' | 'off' | 'unsupported';

/** Liga/desliga push neste navegador — some sozinho se o navegador não suportar (sem opção inútil pra mostrar). */
export function PushToggle({ large }: { large?: boolean }) {
  const toast = useToast();
  const [status, setStatus] = useState<Status>('loading');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) { setStatus('unsupported'); return; }
    getCurrentPushSubscription().then((sub) => setStatus(sub ? 'on' : 'off'));
  }, []);

  async function toggle() {
    setBusy(true);
    try {
      if (status === 'on') {
        await disablePush();
        setStatus('off');
        toast.success('Notificações desativadas', 'Você não vai mais receber push neste aparelho.');
      } else {
        await enablePush();
        setStatus('on');
        toast.success('Notificações ativadas', 'Você vai receber push mesmo com o app fechado.');
      }
    } catch (err) {
      toast.error('Não foi possível ativar', err instanceof Error ? err.message : 'Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  if (status === 'unsupported') return null;

  const isOn = status === 'on';
  const knobSize = large ? 22 : 17;
  const trackWidth = large ? 44 : 36;
  const trackHeight = large ? 26 : 21;

  return (
    <button
      onClick={toggle}
      disabled={busy || status === 'loading'}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: large ? 14 : 10,
        padding: large ? '14px 16px' : '10px 12px', borderRadius: large ? 14 : 11,
        background: 'var(--bg2)', border: '1px solid var(--line)', cursor: 'pointer', textAlign: 'left',
        opacity: busy || status === 'loading' ? 0.6 : 1,
      }}
    >
      <div style={{
        width: large ? 40 : 32, height: large ? 40 : 32, flex: 'none', borderRadius: large ? 12 : 9,
        background: isOn ? 'rgba(34,197,94,.14)' : 'var(--bg3)', color: isOn ? '#22C55E' : 'var(--tx3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Notification color="currentColor" style={{ width: large ? 19 : 15, height: large ? 19 : 15 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: large ? 15 : 13, fontWeight: 600 }}>Notificações no aparelho</div>
        <div style={{ fontSize: large ? 13 : 11, color: 'var(--tx3)' }}>
          {status === 'loading' ? 'Verificando…' : isOn ? 'Ativadas' : 'Desativadas — toque para ativar'}
        </div>
      </div>
      <span style={{ width: trackWidth, height: trackHeight, flex: 'none', borderRadius: 999, background: isOn ? 'var(--pri)' : 'var(--bg4)', position: 'relative', transition: 'background .15s' }}>
        <span style={{ position: 'absolute', top: 2, left: isOn ? trackWidth - knobSize - 2 : 2, width: knobSize, height: knobSize, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
      </span>
    </button>
  );
}
