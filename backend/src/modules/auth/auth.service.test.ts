import bcrypt from 'bcryptjs';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb, testDb, testPool } from '../../test/db.js';
import type { GoogleProfile } from '../../lib/googleAuth.js';
import { generateOpaqueToken, hashToken } from '../../lib/tokens.js';
import { createCompaniesRepository } from './companies.repository.js';
import { createUsersRepository } from './users.repository.js';
import { createAuthService } from './auth.service.js';
import { createCompanyRepository } from '../company/company.repository.js';
import { createCreatorsService } from '../creators/creators.service.js';

/** Fake — evita chamar o Google de verdade no teste (mesmo padrão de buildFakeStripe em billing.service.test.ts). */
function fakeGoogleVerifier(profile: GoogleProfile) {
  return vi.fn().mockResolvedValue(profile);
}

function googleProfile(overrides: Partial<GoogleProfile> = {}): GoogleProfile {
  return { email: 'fulano@acme.com', emailVerified: true, name: 'Fulano da Silva', picture: 'https://photo.example/fulano.jpg', googleId: 'google-sub-123', ...overrides };
}

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

  it('login numa conta pending (sem senha) falha com INVALID_CREDENTIALS, nunca compara bcrypt contra null', async () => {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme-pending' });
    await usersRepo.create({ tenantId: company.id, name: 'convidado@acme.com', email: 'convidado@acme.com', passwordHash: null, role: 'operacional', status: 'pending' });

    await expect(authService.login('convidado@acme.com', 'qualquer-coisa')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('loginWithGoogle (botão comum) numa conta pending falha com ACCOUNT_PENDING_INVITE — só o link de convite ativa', async () => {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme-google-1' });
    await usersRepo.create({ tenantId: company.id, name: 'fulano@acme.com', email: 'fulano@acme.com', passwordHash: null, role: 'operacional', status: 'pending' });
    const service = createAuthService(testDb, fakeGoogleVerifier(googleProfile()));

    await expect(service.loginWithGoogle('fake-id-token')).rejects.toMatchObject({ code: 'ACCOUNT_PENDING_INVITE' });
  });

  it('loginWithGoogle numa conta já active só vincula google_id, sem sobrescrever o nome já cadastrado', async () => {
    await createDemoUser('senha-correta'); // já active, com nome real "Fulano"
    const service = createAuthService(testDb, fakeGoogleVerifier(googleProfile({ name: 'Outro Nome Qualquer' })));

    const result = await service.loginWithGoogle('fake-id-token');

    expect(result.user.name).toBe('Fulano'); // não foi sobrescrito
    expect(result.user.avatarUrl).toBe('https://photo.example/fulano.jpg'); // estava null, preencheu
  });

  it('loginWithGoogle sem conta cadastrada para o e-mail falha com ACCOUNT_NOT_FOUND', async () => {
    const service = createAuthService(testDb, fakeGoogleVerifier(googleProfile({ email: 'ninguem@acme.com' })));

    await expect(service.loginWithGoogle('fake-id-token')).rejects.toMatchObject({ code: 'ACCOUNT_NOT_FOUND' });
  });

  it('loginWithGoogle numa conta inactive falha com ACCOUNT_NOT_FOUND (desativação não é contornável pelo Google)', async () => {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme-google-2' });
    await usersRepo.create({ tenantId: company.id, name: 'Inativo', email: 'inativo@acme.com', passwordHash: null, role: 'operacional', status: 'inactive' });
    const service = createAuthService(testDb, fakeGoogleVerifier(googleProfile({ email: 'inativo@acme.com' })));

    await expect(service.loginWithGoogle('fake-id-token')).rejects.toMatchObject({ code: 'ACCOUNT_NOT_FOUND' });
  });

  it('loginWithGoogle com e-mail não verificado pelo Google falha com GOOGLE_EMAIL_NOT_VERIFIED', async () => {
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme-google-3' });
    await usersRepo.create({ tenantId: company.id, name: 'convidado2@acme.com', email: 'convidado2@acme.com', passwordHash: null, role: 'operacional', status: 'pending' });
    const service = createAuthService(testDb, fakeGoogleVerifier(googleProfile({ email: 'convidado2@acme.com', emailVerified: false })));

    await expect(service.loginWithGoogle('fake-id-token')).rejects.toMatchObject({ code: 'GOOGLE_EMAIL_NOT_VERIFIED' });
  });

  async function createPendingUserWithInvite(email: string, slug: string) {
    const company = await companiesRepo.create({ name: 'Acme', slug });
    const rawToken = generateOpaqueToken();
    await usersRepo.create({ tenantId: company.id, name: email, email, passwordHash: null, role: 'operacional', status: 'pending', inviteTokenHash: hashToken(rawToken) });
    return { company, rawToken };
  }

  it('claimInviteWithGoogle com token válido e e-mail batendo ativa a conta e invalida o token', async () => {
    const { rawToken } = await createPendingUserWithInvite('convite1@acme.com', 'acme-claim-1');
    const service = createAuthService(testDb, fakeGoogleVerifier(googleProfile({ email: 'convite1@acme.com' })));

    const result = await service.claimInviteWithGoogle(rawToken, 'fake-id-token');

    expect(result.token).toBeDefined();
    expect(result.user.name).toBe('Fulano da Silva');
    expect(result.user.status).toBe('active');

    // uso único: a mesma reivindicação de novo falha, mesmo token e e-mail corretos.
    await expect(service.claimInviteWithGoogle(rawToken, 'fake-id-token')).rejects.toMatchObject({ code: 'INVALID_INVITE_TOKEN' });
  });

  it('claimInviteWithGoogle com token inexistente/inválido falha com INVALID_INVITE_TOKEN', async () => {
    const service = createAuthService(testDb, fakeGoogleVerifier(googleProfile()));
    await expect(service.claimInviteWithGoogle('token-que-nunca-existiu', 'fake-id-token')).rejects.toMatchObject({ code: 'INVALID_INVITE_TOKEN' });
  });

  it('claimInviteWithGoogle com Google de um e-mail diferente do convite falha com INVITE_EMAIL_MISMATCH (token sozinho não basta)', async () => {
    const { rawToken } = await createPendingUserWithInvite('convite2@acme.com', 'acme-claim-2');
    // alguém com o token em mãos, mas logando com OUTRA conta Google — não pode reivindicar.
    const service = createAuthService(testDb, fakeGoogleVerifier(googleProfile({ email: 'outra-pessoa@gmail.com' })));

    await expect(service.claimInviteWithGoogle(rawToken, 'fake-id-token')).rejects.toMatchObject({ code: 'INVITE_EMAIL_MISMATCH' });
  });

  it('claimInviteWithGoogle com e-mail batendo mas token errado falha com INVALID_INVITE_TOKEN (e-mail sozinho não basta)', async () => {
    await createPendingUserWithInvite('convite3@acme.com', 'acme-claim-3');
    const service = createAuthService(testDb, fakeGoogleVerifier(googleProfile({ email: 'convite3@acme.com' })));

    await expect(service.claimInviteWithGoogle('token-errado', 'fake-id-token')).rejects.toMatchObject({ code: 'INVALID_INVITE_TOKEN' });
  });

  it('creatorsService.regenerateInvite gera um token que funciona pro claim — o antigo (da criação) deixa de funcionar', async () => {
    const creatorsService = createCreatorsService(testDb);
    const company = await companiesRepo.create({ name: 'Acme', slug: 'acme-regen' });

    const created = await creatorsService.create(company.id, { email: 'regen@acme.com', employment_type: 'fixed' });
    const oldToken = created.inviteToken!;

    const { inviteToken: newToken } = await creatorsService.regenerateInvite(company.id, created.id);
    expect(newToken).not.toBe(oldToken);

    const service = createAuthService(testDb, fakeGoogleVerifier(googleProfile({ email: 'regen@acme.com' })));

    await expect(service.claimInviteWithGoogle(oldToken, 'fake-id-token')).rejects.toMatchObject({ code: 'INVALID_INVITE_TOKEN' });

    const result = await service.claimInviteWithGoogle(newToken, 'fake-id-token');
    expect(result.user.status).toBe('active');
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

  it('startTrial cria empresa em trial (4h) + admin, e já devolve sessão (login automático)', async () => {
    const result = await authService.startTrial({
      companyName: 'Empresa Trial',
      adminName: 'Admin Trial',
      adminEmail: 'admin@trial.com',
      adminPassword: 'senha12345',
    });

    expect(result.token).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.user.email).toBe('admin@trial.com');
    expect(result.user.role).toBe('admin');

    const company = await companiesRepo.findById(result.user.tenantId);
    expect(company?.status).toBe('trial');
    expect(company?.trialEndsAt).toBeInstanceOf(Date);
    // ~4h no futuro (margem generosa pra não ficar flaky por timing).
    const hoursAhead = (company!.trialEndsAt!.getTime() - Date.now()) / (60 * 60 * 1000);
    expect(hoursAhead).toBeGreaterThan(3.9);
    expect(hoursAhead).toBeLessThan(4.1);
  });

  it('startTrial recusa e-mail já em uso', async () => {
    await createDemoUser('senha-correta');
    await expect(
      authService.startTrial({ companyName: 'Outra', adminName: 'X', adminEmail: 'fulano@acme.com', adminPassword: 'senha12345' }),
    ).rejects.toMatchObject({ code: 'EMAIL_TAKEN' });
  });

  it('login funciona normalmente dentro do prazo do trial', async () => {
    await authService.startTrial({ companyName: 'Trial Válido', adminName: 'Admin', adminEmail: 'valido@trial.com', adminPassword: 'senha12345' });

    const result = await authService.login('valido@trial.com', 'senha12345');
    expect(result.user.email).toBe('valido@trial.com');
  });

  it('login falha com TRIAL_EXPIRED depois que trial_ends_at passou (402, não 401 — não é senha errada)', async () => {
    await authService.startTrial({ companyName: 'Trial Vencido', adminName: 'Admin', adminEmail: 'vencido@trial.com', adminPassword: 'senha12345' });
    const user = await usersRepo.findByEmail('vencido@trial.com');
    // força o vencimento direto no banco, sem esperar 4h de verdade.
    await companiesRepo.setTrialEndsAt(user!.tenantId, new Date(Date.now() - 60_000));

    await expect(authService.login('vencido@trial.com', 'senha12345')).rejects.toMatchObject({ status: 402, code: 'TRIAL_EXPIRED' });
  });

  it('refresh também bloqueia depois do trial vencer — sessão aberta não escapa do bloqueio', async () => {
    const { refreshToken } = await authService.startTrial({ companyName: 'Trial Refresh', adminName: 'Admin', adminEmail: 'refresh@trial.com', adminPassword: 'senha12345' });
    const user = await usersRepo.findByEmail('refresh@trial.com');
    await companiesRepo.setTrialEndsAt(user!.tenantId, new Date(Date.now() - 60_000));

    await expect(authService.refresh(refreshToken)).rejects.toMatchObject({ code: 'TRIAL_EXPIRED' });
  });
});
