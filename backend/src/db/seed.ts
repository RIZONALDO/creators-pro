import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db, pool } from './client.js';
import { createCompaniesRepository } from '../modules/auth/companies.repository.js';
import { createUsersRepository } from '../modules/auth/users.repository.js';
import { createHolidaysRepository } from '../modules/schedule/holidays.repository.js';

// Senha de demo local — NÃO é segredo de produção. Documentada também em backend/README.md.
const DEMO_PASSWORD = 'demo1234';

// Feriados nacionais de data fixa (2026). Feriados móveis (Carnaval, Sexta-feira Santa,
// Corpus Christi — dependem do cálculo de Páscoa) não estão aqui ainda — ver backend/README.md.
const NATIONAL_HOLIDAYS_2026: Array<{ date: string; description: string }> = [
  { date: '2026-01-01', description: 'Confraternização Universal' },
  { date: '2026-04-21', description: 'Tiradentes' },
  { date: '2026-05-01', description: 'Dia do Trabalho' },
  { date: '2026-09-07', description: 'Independência do Brasil' },
  { date: '2026-10-12', description: 'Nossa Senhora Aparecida' },
  { date: '2026-11-02', description: 'Finados' },
  { date: '2026-11-15', description: 'Proclamação da República' },
  { date: '2026-11-20', description: 'Dia Nacional de Zumbi e da Consciência Negra' },
  { date: '2026-12-25', description: 'Natal' },
];

async function main() {
  const companiesRepo = createCompaniesRepository(db);
  const usersRepo = createUsersRepository(db);
  const holidaysRepo = createHolidaysRepository(db);

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

  for (const holiday of NATIONAL_HOLIDAYS_2026) {
    await holidaysRepo.createGlobal(holiday.date, holiday.description);
  }
  console.log(`Feriados nacionais (2026, data fixa): ${NATIONAL_HOLIDAYS_2026.length} seedados/confirmados.`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
