import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from '../auth/companies.repository.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { createCreatorsRepository } from '../creators/creators.repository.js';
import { createShiftsRepository } from './shifts.repository.js';
import { createShiftStandbysRepository } from './shiftStandbys.repository.js';

describe('shiftStandbysRepository', () => {
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);
  const creatorsRepo = createCreatorsRepository(testDb);
  const shiftsRepo = createShiftsRepository(testDb);
  const shiftStandbysRepo = createShiftStandbysRepository(testDb);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  async function setupShiftWithCreators(count: number) {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const gestor = await usersRepo.create({ tenantId: company.id, name: 'Gestora', email: 'g@acme.com', passwordHash: 'hash', role: 'gestor' });
    const shift = await shiftsRepo.create({ tenantId: company.id, shiftDate: '2026-06-21', createdBy: gestor.id });

    const creators = [];
    for (let i = 0; i < count; i++) {
      const u = await usersRepo.create({ tenantId: company.id, name: `Creator ${i}`, email: `creator${i}@acme.com`, passwordHash: 'hash', role: 'operacional' });
      creators.push(await creatorsRepo.createRow({ tenantId: company.id, userId: u.id, employmentType: 'fixed' }));
    }
    return { company, gestor, shift, creators };
  }

  it('setStandbys insere a lista e listByShiftIds devolve só as desse plantão', async () => {
    const { company, shift, creators } = await setupShiftWithCreators(2);

    await shiftStandbysRepo.setStandbys(company.id, shift.id, [creators[0]!.id, creators[1]!.id]);

    const rows = await shiftStandbysRepo.listByShiftIds(company.id, [shift.id]);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.creatorId).sort()).toEqual([creators[0]!.id, creators[1]!.id].sort());
  });

  it('setStandbys substitui a lista anterior (não acumula)', async () => {
    const { company, shift, creators } = await setupShiftWithCreators(2);

    await shiftStandbysRepo.setStandbys(company.id, shift.id, [creators[0]!.id]);
    await shiftStandbysRepo.setStandbys(company.id, shift.id, [creators[1]!.id]);

    const rows = await shiftStandbysRepo.listByShiftIds(company.id, [shift.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.creatorId).toBe(creators[1]!.id);
  });

  it('setStandbys com lista vazia limpa tudo', async () => {
    const { company, shift, creators } = await setupShiftWithCreators(1);
    await shiftStandbysRepo.setStandbys(company.id, shift.id, [creators[0]!.id]);

    await shiftStandbysRepo.setStandbys(company.id, shift.id, []);

    expect(await shiftStandbysRepo.listByShiftIds(company.id, [shift.id])).toHaveLength(0);
  });

  it('listByShiftIds agrupa corretamente quando há mais de 1 plantão', async () => {
    const { company, gestor, creators } = await setupShiftWithCreators(2);
    const shiftA = await shiftsRepo.create({ tenantId: company.id, shiftDate: '2026-06-22', createdBy: gestor.id });
    const shiftB = await shiftsRepo.create({ tenantId: company.id, shiftDate: '2026-06-23', createdBy: gestor.id });
    await shiftStandbysRepo.setStandbys(company.id, shiftA.id, [creators[0]!.id]);
    await shiftStandbysRepo.setStandbys(company.id, shiftB.id, [creators[1]!.id]);

    const rows = await shiftStandbysRepo.listByShiftIds(company.id, [shiftA.id, shiftB.id]);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.shiftId === shiftA.id)?.creatorId).toBe(creators[0]!.id);
    expect(rows.find((r) => r.shiftId === shiftB.id)?.creatorId).toBe(creators[1]!.id);
  });
});
