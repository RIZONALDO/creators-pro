import type { db as Db } from '../../db/client.js';
import type { AuthContext } from '../../middleware/authenticate.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { deleteFileByKey, readFileByKey, saveFile } from '../../lib/localStorage.js';
import { createNoopEmitter, type RealtimeEmitter } from '../../realtime/emitter.js';
import { createNoopPushSender, type PushSender } from '../../realtime/pushSender.js';
import { createCreatorsRepository } from '../creators/creators.repository.js';
import { createCollaboratorsRepository } from '../collaborators/collaborators.repository.js';
import { createTasksRepository } from '../tasks/tasks.repository.js';
import { createServicesRepository } from '../services/services.repository.js';
import { createAbsencesRepository } from '../absences/absences.repository.js';
import { createShiftsRepository } from '../shifts/shifts.repository.js';
import { createMessagesRepository } from '../messages/messages.repository.js';
import { createNotificationsService } from '../notifications/notifications.service.js';
import { createAttachmentsRepository } from './attachments.repository.js';
import type { AttachmentEntity } from '../../db/schema/index.js';

const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25MB — generoso pra foto/vídeo curto de celular, sem deixar passar qualquer coisa.

export interface UploadAttachmentInput {
  entityType: AttachmentEntity;
  entityId: string;
  fileName: string;
  mimeType: string | null;
  buffer: Buffer;
}

export function createAttachmentsService(
  db: typeof Db,
  emitter: RealtimeEmitter = createNoopEmitter(),
  pushSender: PushSender = createNoopPushSender(),
) {
  const repo = createAttachmentsRepository(db);
  const creatorsRepo = createCreatorsRepository(db);
  const collaboratorsRepo = createCollaboratorsRepository(db);
  const tasksRepo = createTasksRepository(db);
  const servicesRepo = createServicesRepository(db);
  const absencesRepo = createAbsencesRepository(db);
  const shiftsRepo = createShiftsRepository(db);
  const messagesRepo = createMessagesRepository(db);
  const notificationsService = createNotificationsService(db, emitter, pushSender);

  /**
   * Confirma que a entidade existe E que o auth tem acesso de leitura a ela — mesma regra de
   * escopo já aplicada em list() de cada módulo (operacional só vê o que é dele). Mensagem é
   * sempre restrita a quem participa da conversa, pra qualquer role — não tem "modo admin" pra
   * ler conversa privada de terceiros.
   */
  async function assertCanAccessEntity(auth: AuthContext, entityType: AttachmentEntity, entityId: string): Promise<void> {
    if (entityType === 'task') {
      const row = await tasksRepo.findById(auth.tenantId, entityId);
      if (!row) throw notFound('TASK_NOT_FOUND', 'Tarefa não encontrada.');
      if (auth.role === 'operacional') {
        const own = await creatorsRepo.findRowByUserId(auth.tenantId, auth.userId);
        if (!own || row.creatorId !== own.id) throw forbidden('FORBIDDEN', 'Sem acesso a esta tarefa.');
      }
      return;
    }
    if (entityType === 'absence') {
      const row = await absencesRepo.findById(auth.tenantId, entityId);
      if (!row) throw notFound('ABSENCE_NOT_FOUND', 'Ausência não encontrada.');
      if (auth.role === 'operacional') {
        const own = await creatorsRepo.findRowByUserId(auth.tenantId, auth.userId);
        if (!own || row.creatorId !== own.id) throw forbidden('FORBIDDEN', 'Sem acesso a esta ausência.');
      }
      return;
    }
    if (entityType === 'shift') {
      const row = await shiftsRepo.findById(auth.tenantId, entityId);
      if (!row) throw notFound('SHIFT_NOT_FOUND', 'Plantão não encontrado.');
      if (auth.role === 'operacional') {
        const own = await creatorsRepo.findRowByUserId(auth.tenantId, auth.userId);
        if (!own || row.creatorId !== own.id) throw forbidden('FORBIDDEN', 'Sem acesso a este plantão.');
      }
      return;
    }
    if (entityType === 'service') {
      const row = await servicesRepo.findById(auth.tenantId, entityId);
      if (!row) throw notFound('SERVICE_NOT_FOUND', 'Serviço não encontrado.');
      if (auth.role === 'operacional') {
        const own = await collaboratorsRepo.findRowByUserId(auth.tenantId, auth.userId);
        if (!own || row.collaboratorId !== own.id) throw forbidden('FORBIDDEN', 'Sem acesso a este serviço.');
      }
      return;
    }
    // message
    const row = await messagesRepo.findById(auth.tenantId, entityId);
    if (!row) throw notFound('MESSAGE_NOT_FOUND', 'Mensagem não encontrada.');
    if (row.senderId !== auth.userId && row.receiverId !== auth.userId) throw forbidden('FORBIDDEN', 'Sem acesso a esta mensagem.');
  }

  return {
    async upload(auth: AuthContext, input: UploadAttachmentInput) {
      if (input.buffer.length === 0) throw badRequest('EMPTY_FILE', 'Arquivo vazio.');
      if (input.buffer.length > MAX_SIZE_BYTES) throw badRequest('FILE_TOO_LARGE', 'Arquivo maior que 25MB.');
      await assertCanAccessEntity(auth, input.entityType, input.entityId);

      const saved = await saveFile(auth.tenantId, input.fileName, input.buffer);
      const created = await repo.create({
        tenantId: auth.tenantId,
        fileName: input.fileName,
        fileUrl: saved.key,
        mimeType: input.mimeType,
        sizeBytes: saved.sizeBytes,
        entityType: input.entityType,
        entityId: input.entityId,
        uploadedBy: auth.userId,
      });

      // "Registro da Tarefa" (specs/06): o gestor que criou a tarefa fica sabendo na hora que o
      // creator registrou uma foto — sem isso, só veria abrindo a tarefa de novo manualmente.
      if (input.entityType === 'task') {
        const task = await tasksRepo.findById(auth.tenantId, input.entityId);
        if (task && task.createdBy && task.createdBy !== auth.userId) {
          await notificationsService.notify(auth.tenantId, task.createdBy, 'registro_tarefa', 'Novo registro de tarefa', `${task.title} — ${input.fileName}`);
        }
      }

      return created;
    },

    async listForEntity(auth: AuthContext, entityType: AttachmentEntity, entityId: string) {
      await assertCanAccessEntity(auth, entityType, entityId);
      return repo.listForEntity(auth.tenantId, entityType, entityId);
    },

    /** Pro GET /attachments/:id/file — devolve os bytes só depois de confirmar acesso à entidade dona. */
    async getFile(auth: AuthContext, id: string) {
      const attachment = await repo.findById(auth.tenantId, id);
      if (!attachment) throw notFound('ATTACHMENT_NOT_FOUND', 'Anexo não encontrado.');
      await assertCanAccessEntity(auth, attachment.entityType, attachment.entityId);
      const buffer = await readFileByKey(attachment.fileUrl);
      return { attachment, buffer };
    },

    async remove(auth: AuthContext, id: string) {
      const attachment = await repo.findById(auth.tenantId, id);
      if (!attachment) throw notFound('ATTACHMENT_NOT_FOUND', 'Anexo não encontrado.');
      await assertCanAccessEntity(auth, attachment.entityType, attachment.entityId);
      // só quem subiu (ou gestor/admin) pode excluir — mesmo critério de outras exclusões no sistema.
      if (auth.role === 'operacional' && attachment.uploadedBy !== auth.userId) {
        throw forbidden('FORBIDDEN', 'Só quem enviou o anexo pode excluí-lo.');
      }
      await repo.delete(auth.tenantId, id);
      await deleteFileByKey(attachment.fileUrl);
    },
  };
}

export type AttachmentsService = ReturnType<typeof createAttachmentsService>;
