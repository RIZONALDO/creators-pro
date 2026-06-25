import { z } from 'zod';

export const signupSchema = z.object({
  company_name: z.string().trim().min(2, 'Nome da empresa precisa ter pelo menos 2 caracteres.').max(255),
  admin_name: z.string().trim().min(2, 'Nome precisa ter pelo menos 2 caracteres.').max(255),
  admin_email: z.string().trim().toLowerCase().email('E-mail inválido.'),
  admin_password: z.string().min(8, 'Senha precisa ter pelo menos 8 caracteres.'),
});

/** Mesmo formato de signupSchema — usado pra criar a empresa/admin direto, sem Stripe (trial de 4h). */
export const trialSignupSchema = signupSchema;

export const upgradeTrialSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido.'),
  password: z.string().min(1, 'Informe a senha.'),
});
