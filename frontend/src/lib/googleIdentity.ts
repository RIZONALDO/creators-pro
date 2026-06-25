/**
 * Carrega e inicializa o Google Identity Services (botão "Continuar com Google") do lado do
 * navegador. O backend é quem de fato verifica o ID token (backend/src/lib/googleAuth.ts) — aqui
 * só carrega o script oficial do Google e renderiza o botão dele.
 */
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

export function isGoogleSignInConfigured(): boolean {
  return Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
}

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  scriptPromise ??= new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (existing) { resolve(); return; }
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Não foi possível carregar o script do Google.'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/** Carrega o script (se preciso) e desenha o botão do Google dentro de `parent`. Combinação
 * escolhida pela documentação oficial (GsiButtonConfiguration): `standard` (ícone+texto, mais
 * claro que só ícone) + `outline` (contorno discreto, sem preencher cor) + `pill` (combina com o
 * resto dos botões do app) + texto "Continuar com o Google". Sem `width` fixo — o `parent` (sem
 * largura forçada, ver Login.tsx) já garante o tamanho natural do botão.
 *
 * `isCancelled` evita o flicker do StrictMode (efeito roda 2x em dev: monta, desmonta, monta de
 * novo) — sem isso, o primeiro carregamento do script terminava DEPOIS do React já ter desmontado
 * e remontado o efeito, e ainda assim desenhava o botão (que seria limpo e redesenhado de novo
 * pela segunda chamada), gerando um piscar visível de alguns milissegundos.
 * `onCredential` recebe o ID token assim que a pessoa escolhe a conta Google. */
export async function renderGoogleSignInButton(
  parent: HTMLElement,
  onCredential: (idToken: string) => void,
  isCancelled?: () => boolean,
): Promise<void> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('Login com Google não está configurado (VITE_GOOGLE_CLIENT_ID ausente).');

  await loadScript();
  if (isCancelled?.()) return;
  if (!window.google?.accounts?.id) throw new Error('Não foi possível carregar o Google Identity Services.');

  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: (response) => onCredential(response.credential),
  });
  parent.innerHTML = '';
  window.google.accounts.id.renderButton(parent, {
    type: 'standard', theme: 'outline', shape: 'pill', size: 'large', text: 'continue_with', logo_alignment: 'left', locale: 'pt-BR',
  });
}
