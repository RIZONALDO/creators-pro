import { z } from 'zod';
import { employmentTypeSchema } from '../creators/creators.schemas.js';

export const newCollaboratorSchema = z.object({
  // Ambos opcionais: mesma lógica de convite "pendente" de creators.schemas.ts.
  name: z.string().min(1).optional(),
  email: z.string().trim().toLowerCase().email('E-mail inválido.'),
  phone: z.string().nullable().optional(),
  profession: z.string().min(1),
  employment_type: employmentTypeSchema,
  active: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

export const updateCollaboratorSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().trim().toLowerCase().email('E-mail inválido.').optional(),
  phone: z.string().nullable().optional(),
  profession: z.string().min(1).optional(),
  employment_type: employmentTypeSchema.optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).optional(),
});
