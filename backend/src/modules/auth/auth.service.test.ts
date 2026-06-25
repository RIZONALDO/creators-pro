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

/** Fake — evita chamar o Resend de verdade no teste; também serve pra inspecionar o que seria enviado. */
function fakeEmailSender() {
  return { send: vi.fn().mockResolvedValue(undefined) };
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

  it('startTrial manda e-mail de boas-vindas incentivando assinar', async () => {
    const emailSender = fakeEmailSender();
    const service = createAuthService(testDb, undefined, emailSender);

    await service.startTrial({ companyName: 'Empresa Boas Vindas', adminName: 'Admin BV', adminEmail: 'admin@boasvindas.com', adminPassword: 'senha12345' });

    expect(emailSender.send).toHaveBeenCalledTimes(1);
    expect(emailSender.send).toHaveBeenCalledWith(expect.objectContaining({
      to: 'admin@boasvindas.com',
      subject: expect.stringContaining('teste do CreatorsPro'),
      html: expect.stringContaining('Assine o plano Pro'),
    }));
  });

  it('startTrial não falha mesmo se o envio do e-mail der erro (conta já foi criada, não é motivo pra perder)', async () => {
    const emailSender = { send: vi.fn().mockRejectedValue(new Error('Resend fora do ar')) };
    const service = createAuthService(testDb, undefined, emailSender);

    const result = await service.startTrial({ companyName: 'Empresa Email Falha', adminName: 'Admin', adminEmail: 'admin@emailfalha.com', adminPassword: 'senha12345' });
    expect(result.user.email).toBe('admin@emailfalha.com');
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

  it('requestPasswordReset manda e-mail com link quando a conta existe e está ativa', async () => {
    await createDemoUser('senha-correta');
    const emailSender = fakeEmailSender();
    const service = createAuthService(testDb, undefined, emailSender);

    await service.requestPasswordReset('fulano@acme.com');

    expect(emailSender.send).toHaveBeenCalledTimes(1);
    const call = emailSender.send.mock.calls[0]![0] as { to: string; subject: string; html: string };
    expect(call.to).toBe('fulano@acme.com');
    expect(call.html).toContain('/redefinir-senha/');
  });

  it('requestPasswordReset não manda e-mail nem dá erro pra e-mail inexistente (sem revelar que não existe)', async () => {
    const emailSender = fakeEmailSender();
    const service = createAuthService(testDb, undefined, emailSender);

    await expect(service.requestPasswordReset('ninguem@acme.com')).resolves.toBeUndefined();
    expect(emailSender.send).not.toHaveBeenCalled();
  });

  it('requestPasswordReset não manda e-mail pra conta pending (nunca teve senha pra resetar)', async () => {
    const company = await companiesRepo.create({ name: 'Acme Pending', slug: 'acme-pending' });
    await usersRepo.create({ tenantId: company.id, name: 'Pendente', email: 'pendente@acme-pending.com', passwordHash: null, role: 'operacional', status: 'pending' });
    const emailSender = fakeEmailSender();
    const service = createAuthService(testDb, undefined, emailSender);

    await service.requestPasswordReset('pendente@acme-pending.com');
    expect(emailSender.send).not.toHaveBeenCalled();
  });

  it('resetPassword com token válido troca a senha e já devolve sessão (login automático)', async () => {
    await createDemoUser('senha-antiga12');
    const emailSender = fakeEmailSender();
    const service = createAuthService(testDb, undefined, emailSender);
    await service.requestPasswordReset('fulano@acme.com');
    const link = emailSender.send.mock.calls[0]![0].html as string;
    const token = link.match(/\/redefinir-senha\/([a-f0-9]+)/)![1]!;

    const result = await service.resetPassword(token, 'senha-nova123');
    expect(result.token).toBeDefined();
    expect(result.user.email).toBe('fulano@acme.com');

    await expect(authService.login('fulano@acme.com', 'senha-antiga12')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    await expect(authService.login('fulano@acme.com', 'senha-nova123')).resolves.toMatchObject({ user: { email: 'fulano@acme.com' } });
  });

  it('resetPassword com token inválido falha com INVALID_RESET_TOKEN', async () => {
    await expect(authService.resetPassword('token-que-nao-existe', 'senha-nova123')).rejects.toMatchObject({ code: 'INVALID_RESET_TOKEN' });
  });

  it('resetPassword com token expirado falha com INVALID_RESET_TOKEN', async () => {
    const { user } = await createDemoUser('senha-antiga12');
    const token = generateOpaqueToken();
    await usersRepo.setPasswordResetToken(user.id, hashToken(token), new Date(Date.now() - 60_000));

    await expect(authService.resetPassword(token, 'senha-nova123')).rejects.toMatchObject({ code: 'INVALID_RESET_TOKEN' });
  });

  it('resetPassword invalida o token depois de usado (uso único)', async () => {
    const { user } = await createDemoUser('senha-antiga12');
    const token = generateOpaqueToken();
    await usersRepo.setPasswordResetToken(user.id, hashToken(token), new Date(Date.now() + 60 * 60 * 1000));

    await authService.resetPassword(token, 'senha-nova123');
    await expect(authService.resetPassword(token, 'outra-senha123')).rejects.toMatchObject({ code: 'INVALID_RESET_TOKEN' });
  });

  it('resetPassword com trial vencido: troca a senha de verdade mesmo bloqueando a sessão, e o erro carrega o e-mail', async () => {
    const { user } = await authService.startTrial({ companyName: 'Trial Reset', adminName: 'Admin', adminEmail: 'trialreset@trial.com', adminPassword: 'senha-antiga12' });
    await companiesRepo.setTrialEndsAt(user.tenantId, new Date(Date.now() - 60_000));

    const token = generateOpaqueToken();
    await usersRepo.setPasswordResetToken(user.id, hashToken(token), new Date(Date.now() + 60 * 60 * 1000));

    await expect(authService.resetPassword(token, 'senha-nova123')).rejects.toMatchObject({
      code: 'TRIAL_EXPIRED',
      details: { email: 'trialreset@trial.com', password_changed: true },
    });

    // a senha foi trocada de verdade, mesmo com a sessão bloqueada — não é "a redefinição falhou".
    const reloaded = await usersRepo.findById(user.id);
    const passwordOk = await bcrypt.compare('senha-nova123', reloaded!.passwordHash!);
    expect(passwordOk).toBe(true);
  });

  it('resetPassword com empresa suspensa: mesma lógica (senha troca, erro carrega o e-mail)', async () => {
    const { company, user } = await createDemoUser('senha-antiga12');
    await companiesRepo.updateStatus(company.id, 'suspended');
    const token = generateOpaqueToken();
    await usersRepo.setPasswordResetToken(user.id, hashToken(token), new Date(Date.now() + 60 * 60 * 1000));

    await expect(authService.resetPassword(token, 'senha-nova123')).rejects.toMatchObject({
      code: 'SUBSCRIPTION_INACTIVE',
      details: { email: 'fulano@acme.com', password_changed: true },
    });
  });
});
