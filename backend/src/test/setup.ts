import dotenv from 'dotenv';
import { resolve } from 'node:path';

// Carrega .env.test ANTES de qualquer teste importar src/lib/env.ts ou src/db/client.ts —
// dotenv não sobrescreve env vars já definidas, então esta precisa ser a primeira a rodar
// (garantido pelo setupFiles do Vitest, que executa antes do módulo do teste ser importado).
dotenv.config({ path: resolve(process.cwd(), '.env.test') });
