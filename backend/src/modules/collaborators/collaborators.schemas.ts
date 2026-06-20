import { z } from 'zod';
import { employmentTypeSchema } from '../creators/creators.schemas.js';

export const newCollaboratorSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().nullable().optional(),
  profession: z.string().min(1),
  employment_type: employmentTypeSchema,
  active: z.boolean().optional(),
});

export const updateCollaboratorSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().nullable().optional(),
  profession: z.string().min(1).optional(),
  employment_type: employmentTypeSchema.optional(),
  active: z.boolean().optional(),
});
