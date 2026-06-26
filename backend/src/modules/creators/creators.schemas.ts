import { z } from 'zod';

export const employmentTypeSchema = z.enum(['fixed', 'freelancer']);

export const newCreatorSchema = z.object({
  // Ambos opcionais: gestor pode criar só com e-mail (convite "pendente" — login só via Google até
  // a primeira autenticação, que captura o nome real e ativa a conta). Ver creators.service.ts#create.
  name: z.string().min(1).optional(),
  email: z.string().trim().toLowerCase().email('E-mail inválido.'),
  phone: z.string().nullable().optional(),
  employment_type: employmentTypeSchema,
  active: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

export const updateCreatorSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().trim().toLowerCase().email('E-mail inválido.').optional(),
  phone: z.string().nullable().optional(),
  employment_type: employmentTypeSchema.optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

export const reorderCreatorsSchema = z.object({
  creator_ids: z.array(z.string().uuid()).min(1),
});
