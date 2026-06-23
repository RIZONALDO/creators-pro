import bcrypt from 'bcryptjs';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testDb, testPool } from '../../test/db.js';
import { createCompaniesRepository } from './companies.repository.js';
import { createUsersRepository } from './users.repository.js';
import { createAuthService } from './auth.service.js';
import { createCompanyRepository } from '../company/company.repository.js';

describe('authService', () => {
  const authService = createAuthService(testDb);
  const companiesRepo = createCompaniesRepository(testDb);
  const usersRepo = createUsersRepository(testDb);
  const companySettingsRepo = createCompanyRepository(testDb);

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPool.end();
  });

  async function createDemoUser(password: string) {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme' });
    const passwordHash = await bcrypt.hash(password, 4);
    const user = await usersRepo.create({
      tenantId: company.id,
      name: 'Fulano',
      email: 'fulano@acme.com',
      passwordHash,
      role: 'gestor',
    });
    return { company, user };
  }

  it('login com credenciais corretas retorna token + refreshToken + user sem passwordHash', async () => {
    await createDemoUser('senha-correta');

    const result = await authService.login('fulano@acme.com', 'senha-correta');

    expect(result.token).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.user.email).toBe('fulano@acme.com');
    expect((result.user as Record<string, unknown>).passwordHash).toBeUndefined();
  });

  it('login com senha errada falha com INVALID_CREDENTIALS', async () => {
    await createDemoUser('senha-correta');

    await expect(authService.login('fulano@acme.com', 'senha-errada')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('login com e-mail inexistente falha com INVALID_CREDENTIALS (sem revelar que não existe)', async () => {
    await expect(authService.login('ninguem@acme.com', 'qualquer')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('refresh rotaciona o token: o antigo para de funcionar, o novo funciona', async () => {
    await createDemoUser('senha-correta');
    const { refreshToken } = await authService.login('fulano@acme.com', 'senha-correta');

    const refreshed = await authService.refresh(refreshToken);
    expect(refreshed.token).toBeDefined();
    expect(refreshed.refreshToken).not.toBe(refreshToken);

    await expect(authService.refresh(refreshToken)).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
  });

  it('logout revoga o refresh token', async () => {
    await createDemoUser('senha-correta');
    const { refreshToken } = await authService.login('fulano@acme.com', 'senha-correta');

    await authService.logout(refreshToken);

    await expect(authService.refresh(refreshToken)).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
  });

  it('provisionCompany cria company + admin', async () => {
    const result = await authService.provisionCompany({
      name: 'Nova Empresa',
      slug: 'nova-empresa',
      adminName: 'Admin Nova',
      adminEmail: 'admin@novaempresa.com',
      adminPassword: 'senha12345',
    });

    expect(result.company.slug).toBe('nova-empresa');
    expect(result.admin.role).toBe('admin');
    expect(result.admin.tenantId).toBe(result.company.id);
  });

  it('provisionCompany já preenche company_settings.display_name com o nome digitado no signup', async () => {
    const result = await authService.provisionCompany({
      name: 'Studio Norte Produções',
      slug: 'studio-norte-x',
      adminName: 'Admin Studio',
      adminEmail: 'admin@studionorte-x.com',
      adminPassword: 'senha12345',
    });

    const settings = await companySettingsRepo.findByTenant(result.company.id);
    expect(settings?.displayName).toBe('Studio Norte Produções');
  });

  it('provisionCompany com slug duplicado falha com SLUG_TAKEN', async () => {
    await authService.provisionCompany({
      name: 'Empresa 1',
      slug: 'empresa-dup',
      adminName: 'Admin 1',
      adminEmail: 'admin1@empresa.com',
      adminPassword: 'senha12345',
    });

    await expect(
      authService.provisionCompany({
        name: 'Empresa 2',
        slug: 'empresa-dup',
        adminName: 'Admin 2',
        adminEmail: 'admin2@empresa.com',
        adminPassword: 'senha12345',
      }),
    ).rejects.toMatchObject({ code: 'SLUG_TAKEN' });
  });
});
