import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'deve estar no formato YYYY-MM-DD');

export const newAbsenceSchema = z.object({
  creator_id: z.string().uuid(),
  start_date: isoDate,
  end_date: isoDate,
  reason: z.string().nullable().optional(),
});

export const reviewAbsenceSchema = z.object({
  status: z.enum(['approved', 'rejected']),
});
