import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db, pool } from './client.js';
import { createCompaniesRepository } from '../modules/auth/companies.repository.js';
import { createUsersRepository } from '../modules/auth/users.repository.js';

// Senha de demo local — NÃO é segredo de produção. Documentada também em backend/README.md.
const DEMO_PASSWORD = 'demo1234';

async function main() {
  const companiesRepo = createCompaniesRepository(db);
  const usersRepo = createUsersRepository(db);

  let company = await companiesRepo.findBySlug('studio-norte');
  if (!company) {
    company = await companiesRepo.create({ name: 'Studio Norte', slug: 'studio-norte' });
    console.log(`Tenant criado: ${company.name} (${company.id})`);
  } else {
    console.log(`Tenant já existia: ${company.name} (${company.id})`);
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const demoUsers = [
    { name: 'Fernanda Lima', email: 'fernanda@studionorte.com', role: 'gestor' as const },
    { name: 'Carlos Andrade', email: 'carlos@studionorte.com', role: 'admin' as const },
  ];

  for (const demo of demoUsers) {
    const existing = await usersRepo.findByEmail(demo.email);
    if (existing) {
      console.log(`Usuário já existia: ${demo.email}`);
      continue;
    }
    await usersRepo.create({ tenantId: company.id, name: demo.name, email: demo.email, passwordHash, role: demo.role });
    console.log(`Usuário criado: ${demo.email} (${demo.role}) — senha demo: ${DEMO_PASSWORD}`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
