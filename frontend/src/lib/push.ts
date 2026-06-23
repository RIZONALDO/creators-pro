/**
 * Inscrição em Web Push do lado do navegador. O envio de fato (web-push/VAPID) é todo no
 * backend (backend/src/realtime/pushSender.ts) — aqui só pede permissão, assina com a chave
 * pública do servidor e manda a inscrição pra api.push.subscribe().
 */
import { api } from '@/api';

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function isIos(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

/** No iOS, a Push API só existe depois de "Adicionar à Tela de Início" — dentro de uma aba normal
 * do Safari ela nem é exposta (isPushSupported() já dá false). Usado pra mostrar uma instrução
 * em vez de simplesmente esconder o recurso sem explicação. */
export function isStandaloneDisplay(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

/** Pede permissão (precisa ser chamado a partir de um gesto do usuário — clique num botão) e inscreve. */
export async function enablePush(): Promise<void> {
  if (!isPushSupported()) throw new Error('Seu navegador não suporta notificações push.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permissão de notificação negada.');

  const vapidPublicKey = await api.push.vapidPublicKey();
  if (!vapidPublicKey) throw new Error('Push não está configurado no servidor.');

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error('Inscrição de push incompleta.');
  await api.push.subscribe({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } });
}

export async function disablePush(): Promise<void> {
  const subscription = await getCurrentPushSubscription();
  if (!subscription) return;
  await api.push.unsubscribe(subscription.endpoint);
  await subscription.unsubscribe();
}
