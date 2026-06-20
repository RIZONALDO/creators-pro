import { z } from 'zod';

export const newClientSchema = z.object({
  name: z.string().min(1),
  active: z.boolean().optional(),
});

export const updateClientSchema = z.object({
  name: z.string().min(1).optional(),
  active: z.boolean().optional(),
});
