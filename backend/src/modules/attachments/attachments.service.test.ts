import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { createCreatorsRepository } from '../creators/creators.repository.js';
import { createCollaboratorsRepository } from '../collaborators/collaborators.repository.js';
import { createTasksRepository } from '../tasks/tasks.repository.js';
import { createServicesRepository } from '../services/services.repository.js';
import { createAbsencesRepository } from '../absences/absences.repository.js';
import { createShiftsRepository } from '../shifts/shifts.repository.js';
import { createMessagesRepository } from '../messages/messages.repository.js';
import { createNotificationsRepository } from '../notifications/notifications.repository.js';
import { createAttachmentsService } from './attachments.service.js';

describe('attachmentsService', () => {
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);
  const creatorsRepo = createCreatorsRepository(testDb);
  const collaboratorsRepo = createCollaboratorsRepository(testDb);
  const tasksRepo = createTasksRepository(testDb);
  const servicesRepo = createServicesRepository(testDb);
  const absencesRepo = createAbsencesRepository(testDb);
  const shiftsRepo = createShiftsRepository(testDb);
  const messagesRepo = createMessagesRepository(testDb);
  const notificationsRepo = createNotificationsRepository(testDb);
  const service = createAttachmentsService(testDb);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  async function setupTenant() {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const gestor = await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: 'g@acme.com', passwordHash: 'hash', role: 'gestor' });
    const creatorUser = await usersRepo.create({ tenantId: company.id, name: 'Creator', email: 'creator@acme.com', passwordHash: 'hash', role: 'operacional' });
    const creator = await creatorsRepo.createRow({ tenantId: company.id, userId: creatorUser.id, employmentType: 'fixed' });
    const otherCreatorUser = await usersRepo.create({ tenantId: company.id, name: 'Outro Creator', email: 'outro@acme.com', passwordHash: 'hash', role: 'operacional' });
    const otherCreator = await creatorsRepo.createRow({ tenantId: company.id, userId: otherCreatorUser.id, employmentType: 'fixed' });
    const collaborator = await collaboratorsRepo.createRow({ tenantId: company.id, name: 'Colaborador', profession: 'Editor', employmentType: 'freelancer' });

    const task = await tasksRepo.create({ tenantId: company.id, title: 'Tarefa', taskDate: '2026-06-10', creatorId: creator.id, createdBy: gestor.id });
    const service_ = await servicesRepo.create({ tenantId: company.id, serviceName: 'Serviço', collaboratorId: collaborator.id, createdBy: gestor.id });
    const absence = await absencesRepo.create({ tenantId: company.id, creatorId: creator.id, startDate: '2026-06-05', endDate: '2026-06-07' });
    const shift = await shiftsRepo.create({ tenantId: company.id, shiftDate: '2026-06-08', creatorId: creator.id, createdBy: gestor.id });
    const message = await messagesRepo.create({ tenantId: company.id, senderId: gestor.id, receiverId: creatorUser.id, message: 'Oi' });

    return {
      company, gestor, creator, creatorUser, otherCreator, otherCreatorUser, collaborator,
      task, service: service_, absence, shift, message,
    };
  }

  function asUser(tenantId: string, userId: string, role: 'gestor' | 'operacional' | 'admin' = 'operacional') {
    return { userId, tenantId, role };
  }

  function buffer(text = 'conteúdo do arquivo') {
    return Buffer.from(text, 'utf-8');
  }

  it('gestor consegue subir anexo em qualquer tarefa do tenant', async () => {
    const { company, gestor, task } = await setupTenant();
    const att = await service.upload(asUser(company.id, gestor.id, 'gestor'), {
      entityType: 'task', entityId: task.id, fileName: 'foto.png', mimeType: 'image/png', buffer: buffer(),
    });
    expect(att.entityId).toBe(task.id);
    expect(att.fileName).toBe('foto.png');
  });

  it('operacional sobe anexo na própria tarefa', async () => {
    const { company, creatorUser, task } = await setupTenant();
    await expect(
      service.upload(asUser(company.id, creatorUser.id), { entityType: 'task', entityId: task.id, fileName: 'a.png', mimeType: null, buffer: buffer() }),
    ).resolves.toBeDefined();
  });

  it('operacional não sobe anexo em tarefa de outro creator (403)', async () => {
    const { company, otherCreatorUser, task } = await setupTenant();
    await expect(
      service.upload(asUser(company.id, otherCreatorUser.id), { entityType: 'task', entityId: task.id, fileName: 'a.png', mimeType: null, buffer: buffer() }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('tarefa inexistente dá 404, mesmo pra gestor', async () => {
    const { company, gestor } = await setupTenant();
    await expect(
      service.upload(asUser(company.id, gestor.id, 'gestor'), { entityType: 'task', entityId: '00000000-0000-0000-0000-000000000000', fileName: 'a.png', mimeType: null, buffer: buffer() }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('operacional recebe 403 ao tentar subir anexo em serviço (serviços são geridos só pelo gestor)', async () => {
    const { company, creatorUser, service: svc } = await setupTenant();
    await expect(
      service.upload(asUser(company.id, creatorUser.id), { entityType: 'service', entityId: svc.id, fileName: 'foto.jpg', mimeType: 'image/jpeg', buffer: buffer() }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('gestor sobe anexo num serviço sem problemas', async () => {
    const { company, gestor, service: svc } = await setupTenant();
    const att = await service.upload(asUser(company.id, gestor.id, 'gestor'), { entityType: 'service', entityId: svc.id, fileName: 'foto.jpg', mimeType: 'image/jpeg', buffer: buffer() });
    expect(att.entityId).toBe(svc.id);
  });

  it('creator só sobe anexo na própria ausência e no próprio plantão', async () => {
    const { company, creatorUser, otherCreatorUser, absence, shift } = await setupTenant();
    await expect(service.upload(asUser(company.id, creatorUser.id), { entityType: 'absence', entityId: absence.id, fileName: 'atestado.pdf', mimeType: 'application/pdf', buffer: buffer() })).resolves.toBeDefined();
    await expect(service.upload(asUser(company.id, creatorUser.id), { entityType: 'shift', entityId: shift.id, fileName: 'foto.png', mimeType: null, buffer: buffer() })).resolves.toBeDefined();

    await expect(
      service.upload(asUser(company.id, otherCreatorUser.id), { entityType: 'absence', entityId: absence.id, fileName: 'x.pdf', mimeType: null, buffer: buffer() }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.upload(asUser(company.id, otherCreatorUser.id), { entityType: 'shift', entityId: shift.id, fileName: 'x.png', mimeType: null, buffer: buffer() }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('mensagem só aceita anexo de quem participa da conversa — mesmo gestor de fora não pode', async () => {
    const { company, gestor, creatorUser, otherCreatorUser, message } = await setupTenant();
    await expect(service.upload(asUser(company.id, gestor.id, 'gestor'), { entityType: 'message', entityId: message.id, fileName: 'a.png', mimeType: null, buffer: buffer() })).resolves.toBeDefined();
    await expect(service.upload(asUser(company.id, creatorUser.id), { entityType: 'message', entityId: message.id, fileName: 'b.png', mimeType: null, buffer: buffer() })).resolves.toBeDefined();

    await expect(
      service.upload(asUser(company.id, otherCreatorUser.id), { entityType: 'message', entityId: message.id, fileName: 'c.png', mimeType: null, buffer: buffer() }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('getFile devolve os bytes exatos do que foi enviado', async () => {
    const { company, gestor, task } = await setupTenant();
    const att = await service.upload(asUser(company.id, gestor.id, 'gestor'), { entityType: 'task', entityId: task.id, fileName: 'foto.png', mimeType: 'image/png', buffer: buffer('conteúdo XYZ') });
    const { buffer: read } = await service.getFile(asUser(company.id, gestor.id, 'gestor'), att.id);
    expect(read.toString('utf-8')).toBe('conteúdo XYZ');
  });

  it('listForEntity devolve só os anexos daquela entidade, respeitando o mesmo escopo de acesso', async () => {
    const { company, gestor, creatorUser, otherCreatorUser, task } = await setupTenant();
    await service.upload(asUser(company.id, gestor.id, 'gestor'), { entityType: 'task', entityId: task.id, fileName: 'a.png', mimeType: null, buffer: buffer() });
    await service.upload(asUser(company.id, gestor.id, 'gestor'), { entityType: 'task', entityId: task.id, fileName: 'b.png', mimeType: null, buffer: buffer() });

    const list = await service.listForEntity(asUser(company.id, creatorUser.id), 'task', task.id);
    expect(list).toHaveLength(2);

    await expect(service.listForEntity(asUser(company.id, otherCreatorUser.id), 'task', task.id)).rejects.toMatchObject({ status: 403 });
  });

  it('remove: só quem enviou (ou gestor/admin) pode excluir', async () => {
    const { company, gestor, creatorUser, otherCreatorUser, task } = await setupTenant();
    const att = await service.upload(asUser(company.id, creatorUser.id), { entityType: 'task', entityId: task.id, fileName: 'a.png', mimeType: null, buffer: buffer() });

    await expect(service.remove(asUser(company.id, otherCreatorUser.id), att.id)).rejects.toMatchObject({ status: 403 });
    await expect(service.remove(asUser(company.id, gestor.id, 'gestor'), att.id)).resolves.toBeUndefined();

    await expect(service.getFile(asUser(company.id, gestor.id, 'gestor'), att.id)).rejects.toMatchObject({ status: 404 });
  });

  it('rejeita arquivo vazio', async () => {
    const { company, gestor, task } = await setupTenant();
    await expect(
      service.upload(asUser(company.id, gestor.id, 'gestor'), { entityType: 'task', entityId: task.id, fileName: 'a.png', mimeType: null, buffer: Buffer.alloc(0) }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('"Registro da Tarefa": creator sobe foto na tarefa e o gestor que criou (created_by) recebe notification registro_tarefa', async () => {
    const { company, gestor, creatorUser, task } = await setupTenant();
    await service.upload(asUser(company.id, creatorUser.id), { entityType: 'task', entityId: task.id, fileName: 'foto.png', mimeType: 'image/png', buffer: buffer() });

    const { rows } = await notificationsRepo.list(company.id, gestor.id, { page: 1, pageSize: 50, offset: 0, limit: 50 });
    const triggered = rows.filter((n) => n.type === 'registro_tarefa');
    expect(triggered).toHaveLength(1);
    expect(triggered[0]?.description).toBe(`${task.title} — foto.png`);
  });

  it('upload em serviço (entity_type=service) não dispara registro_tarefa', async () => {
    const { company, gestor, service: svc } = await setupTenant();
    await service.upload(asUser(company.id, gestor.id, 'gestor'), { entityType: 'service', entityId: svc.id, fileName: 'a.jpg', mimeType: null, buffer: buffer() });

    const { rows } = await notificationsRepo.list(company.id, gestor.id, { page: 1, pageSize: 50, offset: 0, limit: 50 });
    expect(rows.filter((n) => n.type === 'registro_tarefa')).toHaveLength(0);
  });

  it('se o próprio gestor (created_by) subir a foto, não notifica a si mesmo', async () => {
    const { company, gestor, task } = await setupTenant();
    await service.upload(asUser(company.id, gestor.id, 'gestor'), { entityType: 'task', entityId: task.id, fileName: 'a.png', mimeType: null, buffer: buffer() });

    const { rows } = await notificationsRepo.list(company.id, gestor.id, { page: 1, pageSize: 50, offset: 0, limit: 50 });
    expect(rows.filter((n) => n.type === 'registro_tarefa')).toHaveLength(0);
  });
});
