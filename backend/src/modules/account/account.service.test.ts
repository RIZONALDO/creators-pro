import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';
import {
  absences, companySettings, creators, creatorTasks, messages, notifications, scaleEntries, scaleMonths, users,
} from '../../db/schema/index.js';
import { createAccountService } from './account.service.js';

describe('accountService', () => {
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);
  const service = createAccountService(testDb);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  /** Povoa quase todo o grafo de FKs (folha, meio e base) — se a ordem de DELETE estiver errada,
   * isso quebra com violação de FK restrict antes de chegar no companies. */
  async function seedTenantWithData() {
    const company = await companiesRepo.create({ name: 'Trial Completo', slug: 'trial-completo', status: 'trial', trialEndsAt: new Date(Date.now() + 1000) });
    const admin = await usersRepo.create({ tenantId: company.id, name: 'Admin', email: 'admin@trialcompleto.com', passwordHash: 'hash', role: 'admin' });
    const creatorUser = await usersRepo.create({ tenantId: company.id, name: 'Creator 1', email: 'creator1@trialcompleto.com', passwordHash: 'hash', role: 'operacional' });

    await testDb.insert(companySettings).values({ tenantId: company.id, displayName: 'Trial Completo' });

    const [creator] = await testDb.insert(creators).values({ tenantId: company.id, userId: creatorUser.id }).returning();
    await testDb.insert(creatorTasks).values({ tenantId: company.id, title: 'Tarefa 1', creatorId: creator!.id, createdBy: admin.id });
    const [month] = await testDb.insert(scaleMonths).values({ tenantId: company.id, month: 6, year: 2026, createdBy: admin.id }).returning();
    await testDb.insert(scaleEntries).values({ tenantId: company.id, scaleMonthId: month!.id, creatorId: creator!.id, workDate: '2026-06-15' });
    await testDb.insert(absences).values({ tenantId: company.id, creatorId: creator!.id, startDate: '2026-06-10', endDate: '2026-06-11' });
    await testDb.insert(messages).values({ tenantId: company.id, senderId: admin.id, receiverId: creatorUser.id, message: 'Oi' });
    await testDb.insert(notifications).values({ tenantId: company.id, userId: creatorUser.id, type: 'nova_tarefa', title: 'Nova tarefa' });

    return { company, admin, creatorUser, creator };
  }

  it('deleteAccount apaga a empresa inteira (todas as tabelas relacionadas) quando em trial', async () => {
    const { company, admin } = await seedTenantWithData();

    await service.deleteAccount({ tenantId: company.id, userId: admin.id, role: 'admin' });

    expect(await companiesRepo.findById(company.id)).toBeNull();
    const remainingUsers = await testDb.select().from(users).where(eq(users.tenantId, company.id));
    expect(remainingUsers).toHaveLength(0);
    const remainingCreators = await testDb.select().from(creators).where(eq(creators.tenantId, company.id));
    expect(remainingCreators).toHaveLength(0);
    const remainingTasks = await testDb.select().from(creatorTasks).where(eq(creatorTasks.tenantId, company.id));
    expect(remainingTasks).toHaveLength(0);
    const remainingEntries = await testDb.select().from(scaleEntries).where(eq(scaleEntries.tenantId, company.id));
    expect(remainingEntries).toHaveLength(0);
    const remainingMonths = await testDb.select().from(scaleMonths).where(eq(scaleMonths.tenantId, company.id));
    expect(remainingMonths).toHaveLength(0);
    const remainingAbsences = await testDb.select().from(absences).where(eq(absences.tenantId, company.id));
    expect(remainingAbsences).toHaveLength(0);
    const remainingMessages = await testDb.select().from(messages).where(eq(messages.tenantId, company.id));
    expect(remainingMessages).toHaveLength(0);
    const remainingNotifications = await testDb.select().from(notifications).where(eq(notifications.tenantId, company.id));
    expect(remainingNotifications).toHaveLength(0);
    const remainingSettings = await testDb.select().from(companySettings).where(eq(companySettings.tenantId, company.id));
    expect(remainingSettings).toHaveLength(0);
  });

  it('deleteAccount recusa com ACCOUNT_DELETE_NOT_ALLOWED quando a empresa não está em trial', async () => {
    const company = await companiesRepo.create({ name: 'Empresa Ativa', slug: 'empresa-ativa-delete' });
    const admin = await usersRepo.create({ tenantId: company.id, name: 'Admin', email: 'admin@empresaativa.com', passwordHash: 'hash', role: 'admin' });

    await expect(
      service.deleteAccount({ tenantId: company.id, userId: admin.id, role: 'admin' }),
    ).rejects.toMatchObject({ status: 409, code: 'ACCOUNT_DELETE_NOT_ALLOWED' });

    // nada foi tocado.
    expect(await companiesRepo.findById(company.id)).not.toBeNull();
  });

  it('deleteAccount recusa empresa suspensa/cancelada também (não só ativa)', async () => {
    const company = await companiesRepo.create({ name: 'Empresa Suspensa', slug: 'empresa-suspensa-delete' });
    await companiesRepo.updateStatus(company.id, 'suspended');
    const admin = await usersRepo.create({ tenantId: company.id, name: 'Admin', email: 'admin@empresasuspensa.com', passwordHash: 'hash', role: 'admin' });

    await expect(
      service.deleteAccount({ tenantId: company.id, userId: admin.id, role: 'admin' }),
    ).rejects.toMatchObject({ status: 409, code: 'ACCOUNT_DELETE_NOT_ALLOWED' });
  });
});
