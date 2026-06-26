import { useEffect, useState } from 'react';
import { Notification, FormClose } from 'grommet-icons';
import { useToast } from '@/context/ToastContext';
import { isPushSupported, isIos, isStandaloneDisplay, getCurrentPushSubscription, enablePush } from '@/lib/push';

const DISMISS_KEY = 'cp_push_prompt_dismissed';

/**
 * Banner na Início (app mobile) pra quem ainda não ativou push — sem isso o recurso fica
 * escondido dentro de Perfil, que o operador pode nunca abrir. No iOS sem instalar ("Adicionar à
 * Tela de Início"), a Push API nem existe no navegador — mostra como instalar em vez de só
 * esconder o botão sem explicação nenhuma.
 */
export function PushPrompt() {
  const toast = useToast();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');
  const [needsInstall, setNeedsInstall] = useState(false);
  const [needsEnable, setNeedsEnable] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (dismissed) return;
    if (isIos() && !isStandaloneDisplay()) {
      setNeedsInstall(true);
      return;
    }
    if (!isPushSupported()) return;
    getCurrentPushSubscription().then((sub) => setNeedsEnable(!sub));
  }, [dismissed]);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  }

  async function activate() {
    setBusy(true);
    try {
      await enablePush();
      toast.success('Notificações ativadas', 'Você vai receber avisos mesmo com o app fechado.');
      setNeedsEnable(false);
    } catch (err) {
      toast.error('Não foi possível ativar', err instanceof Error ? err.message : 'Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  if (dismissed || (!needsInstall && !needsEnable)) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: 'linear-gradient(145deg,rgba(108,99,255,.16),rgba(108,99,255,.05))', border: '1px solid rgba(108,99,255,.28)', borderRadius: 16, padding: 14, marginBottom: 18 }}>
      <div style={{ width: 38, height: 38, flex: 'none', borderRadius: 11, background: 'rgba(108,99,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--pri)' }}>
        <Notification color="currentColor" size="small" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {needsInstall ? (
          <>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>Receba avisos no celular</div>
            <div style={{ fontSize: 12.5, color: 'var(--tx2)', marginTop: 3, lineHeight: 1.4 }}>
              No Safari, toque em <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong> — o iPhone só permite notificações assim.
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>Receba avisos de tarefas e plantões</div>
            <div style={{ fontSize: 12.5, color: 'var(--tx2)', marginTop: 3 }}>Mesmo com o app fechado, no celular.</div>
            <button onClick={activate} disabled={busy} style={{ marginTop: 9, padding: '8px 14px', borderRadius: 10, background: 'var(--pri)', border: 'none', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>
              {busy ? 'Ativando…' : 'Ativar'}
            </button>
          </>
        )}
      </div>
      <button onClick={dismiss} title="Fechar" style={{ flex: 'none', background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer', padding: 4 }}>
        <FormClose color="currentColor" size="small" />
      </button>
    </div>
  );
}
