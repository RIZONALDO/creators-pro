import { z } from 'zod';

export const employmentTypeSchema = z.enum(['fixed', 'freelancer']);

export const newCreatorSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().nullable().optional(),
  employment_type: employmentTypeSchema,
  active: z.boolean().optional(),
  password: z.string().min(8),
});

export const updateCreatorSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().nullable().optional(),
  employment_type: employmentTypeSchema.optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

export const reorderCreatorsSchema = z.object({
  creator_ids: z.array(z.string().uuid()).min(1),
});
