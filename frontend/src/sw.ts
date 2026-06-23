/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

/**
 * GET pra API real (qualquer host candidato do fallback em api/client.ts, todos na :3001) —
 * exclui /auth (nunca servir sessão velha de cache) e /socket.io (upgrade de WebSocket, não fetch).
 * Movido aqui (era config declarativa do generateSW) porque o push precisa de injectManifest —
 * só esse strategy permite os listeners de `push`/`notificationclick` abaixo.
 */
registerRoute(
  ({ url, request }) => request.method === 'GET' && url.port === '3001' && !url.pathname.startsWith('/socket.io') && !url.pathname.startsWith('/auth'),
  new NetworkFirst({
    cacheName: 'creatorspro-api',
    networkTimeoutSeconds: 4,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 }),
      // chave de cache padrão do Workbox não inclui headers — sem isto, duas contas diferentes no
      // mesmo navegador (ex.: trocar de usuário demo) compartilhariam o cache de GET /tasks etc.
      { cacheKeyWillBeUsed: async ({ request }) => `${request.url}::${request.headers.get('Authorization') ?? ''}` },
    ],
  }),
);

interface PushPayload {
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
}

self.addEventListener('push', (event) => {
  let payload: PushPayload = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    // payload não era JSON — segue com o fallback abaixo em vez de falhar a notificação inteira.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'CreatorsPro', {
      body: payload.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: payload.data ?? {},
    }),
  );
});

// Clica na notificação do SO → foca uma aba já aberta do app, ou abre uma nova.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((openClients) => {
      const existing = openClients.find((c) => 'focus' in c);
      if (existing) return existing.focus();
      return self.clients.openWindow('/dashboard');
    }),
  );
});
