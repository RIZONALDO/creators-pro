import bcrypt from 'bcryptjs';
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import { eq } from 'drizzle-orm';
import type { db as Db } from '../../db/client.js';
import { superadmins } from '../../db/schema/index.js';
import { badRequest, unauthorized } from '../../lib/errors.js';
import { signPlatformToken } from '../../lib/jwt.js';

export function createPlatformAuthService(db: typeof Db) {
  return {
    async login(email: string, password: string) {
      const [row] = await db.select().from(superadmins).where(eq(superadmins.email, email)).limit(1);
      if (!row) throw unauthorized('INVALID_CREDENTIALS', 'E-mail ou senha incorretos.');

      const ok = await bcrypt.compare(password, row.passwordHash);
      if (!ok) throw unauthorized('INVALID_CREDENTIALS', 'E-mail ou senha incorretos.');

      // 2FA configurado: pede código TOTP antes de emitir token
      if (row.totpSecret) {
        return { next: 'totp' as const, adminId: row.id };
      }

      const token = signPlatformToken({ sub: row.id, scope: 'platform' });
      return { token, admin: { id: row.id, name: row.name, email: row.email } };
    },

    async verifyTotp(adminId: string, code: string) {
      const [row] = await db.select().from(superadmins).where(eq(superadmins.id, adminId)).limit(1);
      if (!row || !row.totpSecret) throw unauthorized('TOTP_NOT_CONFIGURED', 'TOTP não configurado.');

      const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(row.totpSecret) });
      const delta = totp.validate({ token: code, window: 1 });
      if (delta === null) throw unauthorized('INVALID_TOTP', 'Código TOTP inválido ou expirado.');

      const token = signPlatformToken({ sub: row.id, scope: 'platform' });
      return { token, admin: { id: row.id, name: row.name, email: row.email } };
    },

    async me(id: string) {
      const [row] = await db.select().from(superadmins).where(eq(superadmins.id, id)).limit(1);
      if (!row) throw unauthorized('INVALID_TOKEN', 'Sessão inválida.');
      return { id: row.id, name: row.name, email: row.email, totpEnabled: !!row.totpSecret };
    },

    async setupTotp(id: string) {
      const [row] = await db.select().from(superadmins).where(eq(superadmins.id, id)).limit(1);
      if (!row) throw unauthorized('INVALID_TOKEN', 'Sessão inválida.');
      if (row.totpSecret) throw badRequest('TOTP_ALREADY_ENABLED', '2FA já está configurado.');

      const secret = new OTPAuth.Secret();
      const totp = new OTPAuth.TOTP({
        issuer: 'CreatorsPro',
        label: row.email,
        secret,
      });
      const uri = totp.toString();
      const qrDataUrl = await QRCode.toDataURL(uri);

      return { secret: secret.base32, qrDataUrl };
    },

    async confirmTotp(id: string, secret: string, code: string) {
      const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) });
      const delta = totp.validate({ token: code, window: 1 });
      if (delta === null) throw badRequest('INVALID_TOTP', 'Código inválido — verifique o app autenticador.');

      await db.update(superadmins).set({ totpSecret: secret }).where(eq(superadmins.id, id));
      return { ok: true };
    },

    async disableTotp(id: string, code: string) {
      const [row] = await db.select().from(superadmins).where(eq(superadmins.id, id)).limit(1);
      if (!row || !row.totpSecret) throw badRequest('TOTP_NOT_ENABLED', '2FA não está configurado.');

      const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(row.totpSecret) });
      const delta = totp.validate({ token: code, window: 1 });
      if (delta === null) throw unauthorized('INVALID_TOTP', 'Código TOTP inválido.');

      await db.update(superadmins).set({ totpSecret: null }).where(eq(superadmins.id, id));
      return { ok: true };
    },
  };
}

export type PlatformAuthService = ReturnType<typeof createPlatformAuthService>;
