import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createAuthService } from '../auth/auth.service.js';
import { createUsersRepository } from '../auth/users.repository.js';
import { creators } from '../../db/schema/index.js';
import { createOnboardingService } from './onboarding.service.js';

afterAll(() => testPool.end());
beforeEach(resetDb);

const authService = createAuthService(testDb);
const usersRepo = createUsersRepository(testDb);
const onboarding = createOnboardingService(testDb);

async function setupTenant() {
  const { user } = await authService.startTrial({
    companyName: 'Onboarding Co', adminName: 'Admin', adminEmail: 'admin@onboarding.com', adminPassword: 'senha123',
  });
  return { auth: { tenantId: user.tenantId, userId: user.id, role: 'admin' as const } };
}

describe('onboardingService', () => {
  it('tenant novo tem todos os passos pendentes', async () => {
    const { auth } = await setupTenant();
    const status = await onboarding.getStatus(auth);
    expect(status).toEqual({ has_gestor: false, has_creator: false, has_task: false, has_scale_entry: false });
  });

  it('has_gestor = true após adicionar gestor', async () => {
    const { auth } = await setupTenant();
    await usersRepo.create({ tenantId: auth.tenantId, name: 'Gestor', email: 'gestor@onboarding.com', passwordHash: 'x', role: 'gestor' });
    const status = await onboarding.getStatus(auth);
    expect(status.has_gestor).toBe(true);
    expect(status.has_creator).toBe(false);
  });

  it('has_creator = true após adicionar creator (vinculado a um usuário operacional)', async () => {
    const { auth } = await setupTenant();
    // creators.user_id é NOT NULL — cria um usuário operacional antes de criar o creator
    const operUser = await usersRepo.create({ tenantId: auth.tenantId, name: 'Creator', email: 'creator@onboarding.com', passwordHash: 'x', role: 'operacional' });
    await testDb.insert(creators).values({ tenantId: auth.tenantId, userId: operUser.id, active: true, scaleOrder: 0 });
    const status = await onboarding.getStatus(auth);
    expect(status.has_creator).toBe(true);
  });

  it('admin não conta como gestor no passo has_gestor', async () => {
    const { auth } = await setupTenant();
    // só o admin existe — has_gestor deve ser false (role='admin' não conta)
    const status = await onboarding.getStatus(auth);
    expect(status.has_gestor).toBe(false);
  });
});
