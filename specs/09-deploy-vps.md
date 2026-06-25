# 09 — Deploy em VPS (sem container)

Checklist concreto pra subir o CreatorsPro numa VPS "normal" (Ubuntu/Debian, sem Docker/Docker
Compose) — Node + PostgreSQL + Nginx instalados direto no sistema. Não reabre decisão de
arquitetura nenhuma do app; é só o que muda do ambiente de dev (mkcert, IP de LAN, CORS aberto)
pro ambiente real.

## Por que isso importa agora

Em dev, testamos Service Worker/Push num IP de LAN sem domínio — por isso precisou de mkcert e
instalar certificado manualmente no celular (ver conversa anterior). **Isso é só workaround de
dev.** Com domínio real + certificado de uma CA pública (Let's Encrypt), a mesma exigência de
contexto seguro do navegador é satisfeita de fábrica, sem nenhum passo manual no aparelho de quem
usa o app.

## Arquitetura recomendada

```
Internet ──443/HTTPS──▶ Nginx (Let's Encrypt) ──┬─▶ arquivos estáticos do frontend (dist/)
                                                  └─▶ proxy 127.0.0.1:3001 ──▶ Node (backend)
                                                       (inclui upgrade de WebSocket /socket.io/)
```

- **Nginx termina o HTTPS** (porta 443 pública) — o backend Node escuta só em `127.0.0.1:3001`
  (HTTP puro, nunca exposto direto à internet). `backend/src/server.ts` já está pronto pra isso:
  se não achar `certs/dev-cert.pem`/`dev-key.pem`, cai pra HTTP automaticamente — não precisa
  mudar nada de código, só **não copiar a pasta `certs/` pra VPS**.
- **Frontend é só arquivo estático** — `npm run build` gera `frontend/dist/`; isso é servido
  direto pelo Nginx, sem processo Node nenhum pro frontend em produção (`vite preview` é só pra
  teste local, não é servidor de produção).
- Alternativa ao Nginx: **Caddy** — gerencia Let's Encrypt automaticamente, sem precisar configurar
  certbot/cron de renovação à parte. Mais simples de manter numa VPS pequena; Nginx é mais
  documentado/padrão de mercado. Qualquer um dos dois resolve.

## 1. Certificado (substitui o mkcert)

Não copiar `certs/` (mkcert, só vale pra `localhost`/IP de LAN) pra VPS. Em vez disso:

- **Nginx + certbot**: `certbot --nginx -d seudominio.com` — emite e configura renovação automática.
- **Caddy**: já faz isso sozinho, só apontar o domínio no `Caddyfile`.

## 2. CORS — apertar antes de ir ao ar

Hoje, de propósito pra facilitar dev:
- `backend/src/app.ts`: `app.use(cors())` — sem opções, libera qualquer origem.
- `backend/src/server.ts`: `new SocketIOServer({ cors: { origin: '*' } })`.

Antes de produção, trocar os dois pra restringir à origem real do frontend:
```ts
app.use(cors({ origin: env.frontendUrl }));
// ...
new SocketIOServer({ cors: { origin: env.frontendUrl } });
```
(`env.frontendUrl` novo, lido de uma var de ambiente — ex.: `FRONTEND_URL=https://app.seudominio.com`.)

## 3. Variáveis de ambiente — o que muda

| Variável | Dev | Produção |
|---|---|---|
| `DATABASE_URL` | banco local | banco da VPS (ou serviço gerenciado) — nunca o mesmo banco de dev |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | qualquer string | segredo novo, gerado só pra produção (`openssl rand -hex 32`) |
| `PLATFORM_PROVISION_SECRET` | qualquer string | segredo novo, não reaproveitar o de dev |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | par de dev | **gerar par novo** (`npx web-push generate-vapid-keys`) — não reaproveitar o de dev |
| `VAPID_SUBJECT` | placeholder | contato real (`mailto:suporte@seudominio.com`) |
| `PORT` | 3001 | 3001 (interno — Nginx é quem expõe 443) |
| `FRONTEND_URL` (novo, ver item 2) | — | origem real do frontend, pro CORS |

**Frontend (`frontend/.env`)** — atenção: `VITE_*` é embutido **no build**, não lido em runtime.
O processo de deploy precisa ter o `.env` de produção (`VITE_API_BASE_URL=https://api.seudominio.com`,
`VITE_USE_MOCK=false`) já no lugar **antes** de rodar `npm run build` — se buildar com o `.env` de
dev por engano, o app em produção vai tentar falar com o IP de LAN.

O fallback de hosts em `frontend/src/api/client.ts` (`CANDIDATE_BASE_URLS` — localhost + IPs de
LAN) não causa problema em produção: como `VITE_API_BASE_URL` (o domínio real) responde de
primeira, o fallback simplesmente nunca é acionado. Não precisa remover, mas também não resolve
nada novo em produção — é puramente um resquício de dev.

## 4. Processo do backend sem Docker — systemd

Padrão de VPS sem container: `systemd` mantém o processo Node de pé, reinicia se cair, sobe junto
com o boot. Exemplo (`/etc/systemd/system/creatorspro-api.service`):

```ini
[Unit]
Description=CreatorsPro API
After=network.target postgresql.service

[Service]
Type=simple
User=creatorspro
WorkingDirectory=/var/www/creatorspro/backend
EnvironmentFile=/var/www/creatorspro/backend/.env
ExecStart=/usr/bin/node dist/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now creatorspro-api
```

Alternativa: `pm2` (`pm2 start dist/server.js --name creatorspro-api`) — mais simples de operar no
dia a dia (logs, restart, `pm2 monit`), mas é mais uma dependência global do que `systemd`, que já
vem com o sistema. Qualquer um dos dois resolve; `systemd` é o "padrão da casa" de uma VPS normal.

## 5. Sequência de deploy (cada release)

1. `git pull` (ou copiar os arquivos da release).
2. **Backend**: `npm ci && npm run build` → gera `dist/`.
3. **Migrations antes de reiniciar a API** (nunca depois — API nova rodando contra schema velho
   quebra; ver `specs/07-roadmap-implementacao.md#fase-10--deploy`): `npm run db:migrate`.
4. Reiniciar o processo: `sudo systemctl restart creatorspro-api` (ou `pm2 restart creatorspro-api`).
5. **Frontend**: `.env` de produção no lugar → `npm ci && npm run build` → copiar `dist/` pro
   diretório que o Nginx serve (ex.: `/var/www/creatorspro/frontend-dist`).
6. `sudo nginx -t && sudo systemctl reload nginx` (só se mudou config do Nginx; trocar os arquivos
   estáticos não precisa de reload).

## 6. Nginx — exemplo mínimo

```nginx
server {
  listen 443 ssl;
  server_name app.seudominio.com;
  # ssl_certificate / ssl_certificate_key — preenchido pelo certbot

  root /var/www/creatorspro/frontend-dist;
  try_files $uri /index.html; # SPA — qualquer rota cai no index.html, o React Router resolve

  location /socket.io/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade"; # sem isso, o WebSocket do Socket.IO não conecta
  }

  location ~ ^/(auth|tasks|services|schedule|absences|shifts|messages|conversations|notifications|push|creators|collaborators|clients|users|status-history|holidays|scale-months|scale-entries|professions|reports|attachments|account|company|billing|onboarding|internal|platform/auth|platform/tenants) {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
  # /platform (sem sub-path) serve o SPA — o React detecta o prefix e monta o PlatformApp.
  # As chamadas de API do painel (/platform/auth/*, /platform/tenants) estão no bloco acima.
}

server {
  listen 80;
  server_name app.seudominio.com;
  return 301 https://$host$request_uri; # nunca servir a app em HTTP puro
}
```

A lista de paths em `location ~ ^/(...)` precisa acompanhar o que `backend/src/app.ts` expõe —
se um módulo novo adicionar uma rota na raiz, adiciona o prefixo aqui também. Alternativa mais
simples de manter: proxy_pass de **tudo** pro backend, exceto os paths que o frontend usa
(`/`, `/src/*` em dev, os assets em `/assets/*` no build) — inverte a lista, só não é o padrão
mais comum em exemplos de Nginx+SPA.

## 7. Checklist final antes de ir ao ar

- [ ] Domínio configurado, DNS apontando pra VPS.
- [ ] Certificado emitido (certbot/Caddy) — `https://` sem aviso de navegador.
- [ ] `certs/` (mkcert) **não** copiado pra VPS.
- [ ] CORS restrito à origem real (item 2).
- [ ] Segredos de produção gerados do zero (JWT, provision secret, VAPID) — nenhum reaproveitado de dev.
- [ ] `.env` de produção no frontend **antes** do `npm run build`.
- [ ] Migrations aplicadas antes de reiniciar a API em cada deploy.
- [ ] Processo do backend sob `systemd`/`pm2` (reinicia se cair, sobe no boot).
- [ ] Nginx redireciona HTTP→HTTPS e faz upgrade de WebSocket em `/socket.io/`.
- [ ] Teste real: instalar o PWA num celular de fora da rede local, confirmar push funcionando
      sem nenhum passo manual de certificado (se pedir, algo no domínio/certificado está errado).
