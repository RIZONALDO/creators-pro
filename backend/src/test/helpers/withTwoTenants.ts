import bcrypt from 'bcryptjs';
import { testDb } from '../db.js';
import { createCompaniesRepository } from '../../modules/auth/companies.repository.js';
import { createUsersRepository } from '../../modules/auth/users.repository.js';

export const FIXTURE_PASSWORD = 'fixture-pass-123';

/**
 * Cria 2 tenants (companies) + 1 usuário em cada — base de toda suíte de isolamento
 * entre tenants. Fases futuras (creators, tasks, ...) estendem este helper conforme
 * adicionam recursos novos (ver specs/07-roadmap-implementacao.md).
 */
export async function withTwoTenants() {
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);
  const passwordHash = await bcrypt.hash(FIXTURE_PASSWORD, 4); // rounds baixo: performance em teste, não é senha real

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const companyA = await companiesRepo.create({ name: 'Tenant A', slug: `tenant-a-${suffix}` });
  const companyB = await companiesRepo.create({ name: 'Tenant B', slug: `tenant-b-${suffix}` });

  const userA = await usersRepo.create({
    tenantId: companyA.id,
    name: 'Usuária Tenant A',
    email: `user-a-${suffix}@test.com`,
    passwordHash,
    role: 'gestor',
  });

  const userB = await usersRepo.create({
    tenantId: companyB.id,
    name: 'Usuário Tenant B',
    email: `user-b-${suffix}@test.com`,
    passwordHash,
    role: 'gestor',
  });

  return { companyA, companyB, userA, userB, password: FIXTURE_PASSWORD };
}
