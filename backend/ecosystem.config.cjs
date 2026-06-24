// pm2 — sem segredos aqui (diferente de outros apps deste VPS): backend/src/lib/env.ts já carrega
// .env do diretório de trabalho (dotenv/config), então só precisa apontar pro script + cwd certo.
module.exports = {
  apps: [
    {
      name: 'creatorspro-api',
      script: './dist/server.js',
      cwd: '/var/www/creatorspro/backend',
      env: { NODE_ENV: 'production' },
    },
  ],
};
