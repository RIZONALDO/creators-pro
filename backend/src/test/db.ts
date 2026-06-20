import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import * as schema from '../db/schema/index.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL (.env.test) não definido — setupFiles deveria ter carregado .env.test antes deste import.');
}

export const testPool = new Pool({ connectionString: databaseUrl });
export const testDb = drizzle(testPool, { schema });

/** Limpa as tabelas entre testes — chame em beforeEach. */
export async function resetDb() {
  await testDb.execute(sql`TRUNCATE TABLE refresh_tokens, users, companies CASCADE`);
}
