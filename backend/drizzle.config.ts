import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

// `npm run db:generate` precisa do NODE_OPTIONS=--import=tsx (ver package.json) — o loader CJS
// próprio do drizzle-kit 0.24 não resolve import relativo com extensão .js apontando pra um .ts
// (convenção exigida pelo ESM em produção, ver db/schema/*.ts). Sem isso, falha com
// "Cannot find module './enums.js'" ao carregar este schema.

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL não definido (.env)');

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: databaseUrl },
});
