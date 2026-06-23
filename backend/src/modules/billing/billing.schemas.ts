import { z } from 'zod';

export const signupSchema = z.object({
  company_name: z.string().trim().min(2, 'Nome da empresa precisa ter pelo menos 2 caracteres.').max(255),
  admin_name: z.string().trim().min(2, 'Nome precisa ter pelo menos 2 caracteres.').max(255),
  admin_email: z.string().trim().toLowerCase().email('E-mail inválido.'),
  admin_password: z.string().min(8, 'Senha precisa ter pelo menos 8 caracteres.'),
});
