import { and, asc, eq } from 'drizzle-orm';
import type { db as Db } from '../../db/client.js';
import { attachments, type AttachmentEntity } from '../../db/schema/index.js';
import { firstOrThrow } from '../../lib/firstOrThrow.js';

export interface CreateAttachmentInput {
  tenantId: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  entityType: AttachmentEntity;
  entityId: string;
  uploadedBy: string;
}

export function createAttachmentsRepository(db: typeof Db) {
  return {
    async create(input: CreateAttachmentInput) {
      const rows = await db.insert(attachments).values(input).returning();
      return firstOrThrow(rows);
    },

    async findById(tenantId: string, id: string) {
      const [row] = await db.select().from(attachments).where(and(eq(attachments.tenantId, tenantId), eq(attachments.id, id))).limit(1);
      return row ?? null;
    },

    async listForEntity(tenantId: string, entityType: AttachmentEntity, entityId: string) {
      return db
        .select()
        .from(attachments)
        .where(and(eq(attachments.tenantId, tenantId), eq(attachments.entityType, entityType), eq(attachments.entityId, entityId)))
        .orderBy(asc(attachments.createdAt));
    },

    async delete(tenantId: string, id: string) {
      const rows = await db.delete(attachments).where(and(eq(attachments.tenantId, tenantId), eq(attachments.id, id))).returning();
      return rows[0] ?? null;
    },
  };
}

export type AttachmentsRepository = ReturnType<typeof createAttachmentsRepository>;
