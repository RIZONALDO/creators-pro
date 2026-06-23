import { bigint, index, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { companies } from './companies';
import { users } from './users';

// Polimórfica: cobre task | service | absence | shift | message (mesmo padrão de status_history).
export const attachmentEntityEnum = pgEnum('attachment_entity', ['task', 'service', 'absence', 'shift', 'message']);
export type AttachmentEntity = (typeof attachmentEntityEnum.enumValues)[number];

export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
    fileName: varchar('file_name', { length: 255 }),
    // chave de storage local (caminho relativo dentro de uploads/), não uma URL pública — o arquivo
    // só é servido via /attachments/:id/file, autenticado e checando a entidade dona (specs/01: "banco
    // nunca guarda binário", mas aqui storage é disco local, não S3, então não existe URL pública de verdade).
    fileUrl: text('file_url').notNull(),
    mimeType: varchar('mime_type', { length: 120 }),
    sizeBytes: bigint('size_bytes', { mode: 'number' }),
    entityType: attachmentEntityEnum('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    uploadedBy: uuid('uploaded_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    entityIdx: index('attachments_entity_idx').on(t.tenantId, t.entityType, t.entityId),
  }),
);
