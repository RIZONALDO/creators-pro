import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import type { db as Db } from '../../db/client.js';
import { superadmins } from '../../db/schema/index.js';
import { unauthorized } from '../../lib/errors.js';
import { signPlatformToken } from '../../lib/jwt.js';

export function createPlatformAuthService(db: typeof Db) {
  return {
    async login(email: string, password: string) {
      const [row] = await db.select().from(superadmins).where(eq(superadmins.email, email)).limit(1);
      if (!row) throw unauthorized('INVALID_CREDENTIALS', 'E-mail ou senha incorretos.');

      const ok = await bcrypt.compare(password, row.passwordHash);
      if (!ok) throw unauthorized('INVALID_CREDENTIALS', 'E-mail ou senha incorretos.');

      const token = signPlatformToken({ sub: row.id, scope: 'platform' });
      return { token, admin: { id: row.id, name: row.name, email: row.email } };
    },

    async me(id: string) {
      const [row] = await db.select().from(superadmins).where(eq(superadmins.id, id)).limit(1);
      if (!row) throw unauthorized('INVALID_TOKEN', 'Sessão inválida.');
      return { id: row.id, name: row.name, email: row.email };
    },
  };
}

export type PlatformAuthService = ReturnType<typeof createPlatformAuthService>;
