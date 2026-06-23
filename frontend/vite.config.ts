import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

const CERT_DIR = path.resolve(__dirname, '../certs');

// Service Worker (e por consequência Push) só existe em contexto seguro — localhost é a única
// exceção. Pra testar no celular pelo IP da rede local, precisa de HTTPS de verdade (certificado
// mkcert) — ver certs/README ou o resumo da conversa de como gerar. Sem o certificado, cai pra
// HTTP normal (funciona em localhost, só não dá pra testar push de outro dispositivo).
function readDevCerts() {
  try {
    return {
      cert: readFileSync(path.join(CERT_DIR, 'dev-cert.pem')),
      key: readFileSync(path.join(CERT_DIR, 'dev-key.pem')),
    };
  } catch {
    return undefined;
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // já temos public/manifest.webmanifest + <link rel="manifest"> no index.html — não deixa o
      // plugin gerar/sobrescrever o nosso.
      manifest: false,
      // sem isto, o service worker só roda em build de produção (vite build/preview) — habilitado
      // pra dar pra testar com `npm run dev` mesmo.
      devOptions: { enabled: true, type: 'module' },
      // injectManifest (em vez de generateSW): precisamos escrever o SW à mão (src/sw.ts) pra
      // poder adicionar os listeners de `push`/`notificationclick` — o generateSW é só declarativo
      // (cache), não dá pra plugar push nele.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    port: 5173,
    host: true, // expõe em todas as interfaces (LAN) — necessário pra acessar de outro dispositivo (ex.: celular)
    https: readDevCerts(),
    // sem isso, Vite 5.4.x+ bloqueia requisição por Host header que não seja localhost (proteção
    // contra DNS rebinding) — IP de LAN muda conforme a rede; atualizar aqui se mudar de novo.
    allowedHosts: ['localhost', '192.168.100.47', '10.0.2.14'],
  },
});
