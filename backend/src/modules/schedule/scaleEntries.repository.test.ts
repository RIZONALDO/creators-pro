import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { createCreatorsRepository } from '../creators/creators.repository.js';
import { createScaleMonthsRepository } from './scaleMonths.repository.js';
import { createScaleEntriesRepository } from './scaleEntries.repository.js';

describe('scaleEntriesRepository', () => {
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);
  const creatorsRepo = createCreatorsRepository(testDb);
  const scaleMonthsRepo = createScaleMonthsRepository(testDb);
  const scaleEntriesRepo = createScaleEntriesRepository(testDb);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  async function setupCreator(company: { id: string }, suffix: string) {
    const user = await usersRepo.create({ tenantId: company.id, name: `Creator ${suffix}`, email: `creator-${suffix}@acme.com`, passwordHash: 'hash', role: 'operacional' });
    return creatorsRepo.createRow({ tenantId: company.id, userId: user.id, employmentType: 'fixed' });
  }

  it('create insere e listByWorkDate devolve só as linhas daquele dia', async () => {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const user = await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: 'g@acme.com', passwordHash: 'hash', role: 'gestor' });
    const creator = await setupCreator(company, '1');
    const scaleMonth = await scaleMonthsRepo.create({ tenantId: company.id, month: 6, year: 2026, createdBy: user.id });

    await scaleEntriesRepo.create({ tenantId: company.id, scaleMonthId: scaleMonth.id, workDate: '2026-06-22', creatorId: creator.id });
    await scaleEntriesRepo.create({ tenantId: company.id, scaleMonthId: scaleMonth.id, workDate: '2026-06-23', creatorId: creator.id });

    const day22 = await scaleEntriesRepo.listByWorkDate(company.id, '2026-06-22');
    expect(day22).toHaveLength(1);
    expect(day22[0]?.creatorId).toBe(creator.id);
  });

  it('permite 2 creators diferentes no mesmo dia (mais de 1 por dia)', async () => {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const user = await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: 'g@acme.com', passwordHash: 'hash', role: 'gestor' });
    const creatorA = await setupCreator(company, 'a');
    const creatorB = await setupCreator(company, 'b');
    const scaleMonth = await scaleMonthsRepo.create({ tenantId: company.id, month: 6, year: 2026, createdBy: user.id });

    await scaleEntriesRepo.create({ tenantId: company.id, scaleMonthId: scaleMonth.id, workDate: '2026-06-22', creatorId: creatorA.id });
    await scaleEntriesRepo.create({ tenantId: company.id, scaleMonthId: scaleMonth.id, workDate: '2026-06-22', creatorId: creatorB.id });

    const day22 = await scaleEntriesRepo.listByWorkDate(company.id, '2026-06-22');
    expect(day22).toHaveLength(2);
    expect(day22.map((e) => e.creatorId).sort()).toEqual([creatorA.id, creatorB.id].sort());
  });

  it('findByWorkDateAndCreator localiza o par exato (pra checar duplicidade antes de inserir)', async () => {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const user = await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: 'g@acme.com', passwordHash: 'hash', role: 'gestor' });
    const creator = await setupCreator(company, '1');
    const scaleMonth = await scaleMonthsRepo.create({ tenantId: company.id, month: 6, year: 2026, createdBy: user.id });

    expect(await scaleEntriesRepo.findByWorkDateAndCreator(company.id, '2026-06-22', creator.id)).toBeNull();
    await scaleEntriesRepo.create({ tenantId: company.id, scaleMonthId: scaleMonth.id, workDate: '2026-06-22', creatorId: creator.id });
    expect(await scaleEntriesRepo.findByWorkDateAndCreator(company.id, '2026-06-22', creator.id)).not.toBeNull();
  });

  it('deleteByWorkDateAndCreator remove só aquele creator, mantendo os outros do mesmo dia', async () => {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const user = await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: 'g@acme.com', passwordHash: 'hash', role: 'gestor' });
    const creatorA = await setupCreator(company, 'a');
    const creatorB = await setupCreator(company, 'b');
    const scaleMonth = await scaleMonthsRepo.create({ tenantId: company.id, month: 6, year: 2026, createdBy: user.id });
    await scaleEntriesRepo.create({ tenantId: company.id, scaleMonthId: scaleMonth.id, workDate: '2026-06-22', creatorId: creatorA.id });
    await scaleEntriesRepo.create({ tenantId: company.id, scaleMonthId: scaleMonth.id, workDate: '2026-06-22', creatorId: creatorB.id });

    const deleted = await scaleEntriesRepo.deleteByWorkDateAndCreator(company.id, '2026-06-22', creatorA.id);
    expect(deleted?.creatorId).toBe(creatorA.id);

    const remaining = await scaleEntriesRepo.listByWorkDate(company.id, '2026-06-22');
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.creatorId).toBe(creatorB.id);
  });

  it('createMany insere várias linhas de uma vez e listByMonth retorna em ordem de data', async () => {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const user = await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: 'g@acme.com', passwordHash: 'hash', role: 'gestor' });
    const creator = await setupCreator(company, '1');
    const scaleMonth = await scaleMonthsRepo.create({ tenantId: company.id, month: 6, year: 2026, createdBy: user.id });

    await scaleEntriesRepo.createMany([
      { tenantId: company.id, scaleMonthId: scaleMonth.id, workDate: '2026-06-02', creatorId: creator.id },
      { tenantId: company.id, scaleMonthId: scaleMonth.id, workDate: '2026-06-01', creatorId: creator.id },
    ]);

    const rows = await scaleEntriesRepo.listByMonth(company.id, scaleMonth.id);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.workDate).toBe('2026-06-01');
    expect(rows[1]?.workDate).toBe('2026-06-02');
  });

  it('listByMonth ordena por createdAt entre creators do mesmo dia (ordem estável entre Escala e Dashboard)', async () => {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const user = await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: 'g@acme.com', passwordHash: 'hash', role: 'gestor' });
    const creatorA = await setupCreator(company, 'a');
    const creatorB = await setupCreator(company, 'b');
    const scaleMonth = await scaleMonthsRepo.create({ tenantId: company.id, month: 6, year: 2026, createdBy: user.id });

    // ordem de criação deliberadamente "fora de ordem alfabética" — testa createdAt, não algum outro critério implícito.
    await scaleEntriesRepo.create({ tenantId: company.id, scaleMonthId: scaleMonth.id, workDate: '2026-06-22', creatorId: creatorB.id });
    await scaleEntriesRepo.create({ tenantId: company.id, scaleMonthId: scaleMonth.id, workDate: '2026-06-22', creatorId: creatorA.id });

    const rows = await scaleEntriesRepo.listByMonth(company.id, scaleMonth.id);
    expect(rows.map((r) => r.creatorId)).toEqual([creatorB.id, creatorA.id]); // quem foi adicionado primeiro aparece primeiro
  });

  it('deleteByMonth limpa todas as linhas do mês (regeneração da escala automática)', async () => {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const user = await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: 'g@acme.com', passwordHash: 'hash', role: 'gestor' });
    const creator = await setupCreator(company, '1');
    const scaleMonth = await scaleMonthsRepo.create({ tenantId: company.id, month: 6, year: 2026, createdBy: user.id });
    await scaleEntriesRepo.createMany([
      { tenantId: company.id, scaleMonthId: scaleMonth.id, workDate: '2026-06-01', creatorId: creator.id },
      { tenantId: company.id, scaleMonthId: scaleMonth.id, workDate: '2026-06-02', creatorId: creator.id },
    ]);

    await scaleEntriesRepo.deleteByMonth(company.id, scaleMonth.id);

    expect(await scaleEntriesRepo.listByMonth(company.id, scaleMonth.id)).toHaveLength(0);
  });
});
