import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'deve estar no formato YYYY-MM-DD');

// creator_id é opcional: operacional não tem como descobrir o próprio (GET /creators é bloqueado
// pra ele) — quando omitido e o papel é operacional, o service resolve pelo próprio token.
export const newAbsenceSchema = z.object({
  creator_id: z.string().uuid().optional(),
  start_date: isoDate,
  end_date: isoDate,
  reason: z.string().nullable().optional(),
});

export const reviewAbsenceSchema = z.object({
  status: z.enum(['approved', 'rejected']),
});
