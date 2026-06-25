#!/bin/bash
# Deploy do CreatorsPro na VPS — roda DENTRO de /var/www/creatorspro.
# Fluxo: editar local -> commit -> push -> (na VPS) git pull -> bash deploy.sh
set -e

NGINX_CONF="/etc/nginx/sites-available/creatorspro"

# Lista completa de prefixos de API que o nginx deve proxiar pro backend.
# MANTER SINCRONIZADO com backend/src/app.ts — qualquer rota nova precisa entrar aqui.
# Nota: platform/auth e platform/tenants são API; /platform (sem sub-rota) cai no SPA (index.html).
NGINX_API_PATHS="auth|billing|signup|internal|users|creators|collaborators|clients|professions|status-history|tasks|services|scale-entries|scale-months|holidays|absences|shifts|messages|conversations|notifications|push|reports|attachments|company|account|onboarding|platform/auth|platform/tenants|platform/plans"

cd /var/www/creatorspro
git pull origin main

# ── Backend ──────────────────────────────────────────────────────────────────
cd backend
npm install --omit=dev --prefer-offline
npm run db:migrate
npm run build

# ── Frontend ─────────────────────────────────────────────────────────────────
cd ../frontend
npm install --omit=dev --prefer-offline
npm run build
rsync -a --delete dist/ /var/www/creatorspro-public/

# ── Reinicia o processo Node ──────────────────────────────────────────────────
pm2 restart creatorspro-api --update-env

# ── Nginx: sincroniza o location block com a lista de prefixos de API ─────────
# Idempotente: só toca no nginx se "platform/auth" ainda não constar no config.
# Python faz a substituição de forma segura (pipe nos paths confundiria o sed).
if [ -f "$NGINX_CONF" ] && ! grep -q "platform/auth" "$NGINX_CONF"; then
  echo "Atualizando location block do nginx..."
  python3 -c "
import re, sys
paths = sys.argv[1]
with open(sys.argv[2]) as f:
    conf = f.read()
# Casa o padrão real do nginx nesta VPS: location ~ ^/(...)(/|\$) {
conf = re.sub(
    r'location ~ \^/\([^)]+\)\(/\|\\\$\) \{',
    'location ~ ^/(' + paths + r')(/|\$) {',
    conf,
    count=1,
)
with open(sys.argv[2], 'w') as f:
    f.write(conf)
" "$NGINX_API_PATHS" "$NGINX_CONF"
  nginx -t && systemctl reload nginx
  echo "Nginx recarregado."
fi

echo ""
echo "Deploy concluido!"
echo ""
echo "One-time (so quando necessario):"
echo "  Superadmin (primeira vez): cd /var/www/creatorspro/backend && SUPERADMIN_EMAIL=email SUPERADMIN_PASSWORD=senha npm run db:seed"
