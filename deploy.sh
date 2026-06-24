#!/bin/bash
# Deploy do CreatorsPro na VPS — roda DENTRO de /var/www/creatorspro.
# Fluxo: editar local -> commit -> push -> (na VPS) git pull -> bash deploy.sh
set -e

cd /var/www/creatorspro
git pull origin main

cd backend
npm install
npm run db:migrate
npm run build

cd ../frontend
npm install
npm run build
rsync -a --delete dist/ /var/www/creatorspro-public/

pm2 restart creatorspro-api --update-env

echo "Deploy concluído!"
