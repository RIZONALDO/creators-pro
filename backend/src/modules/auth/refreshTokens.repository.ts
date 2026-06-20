import { and, eq, isNull } from 'drizzle-orm';
import type { db as Db } from '../../db/client.js';
import { firstOrThrow } from '../../lib/firstOrThrow.js';
import { refreshTokens } from '../../db/schema/index.js';

export interface CreateRefreshTokenInput {
  tenantId: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  userAgent?: string | null;
}

export function createRefreshTokensRepository(db: typeof Db) {
  return {
    async create(input: CreateRefreshTokenInput) {
      const rows = await db
        .insert(refreshTokens)
        .values({
          tenantId: input.tenantId,
          userId: input.userId,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
          userAgent: input.userAgent ?? null,
        })
        .returning();
      return firstOrThrow(rows);
    },

    async findActiveByHash(tokenHash: string) {
      const [row] = await db
        .select()
        .from(refreshTokens)
        .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)))
        .limit(1);
      return row ?? null;
    },

    async revoke(id: string) {
      await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, id));
    },
  };
}

export type RefreshTokensRepository = ReturnType<typeof createRefreshTokensRepository>;
