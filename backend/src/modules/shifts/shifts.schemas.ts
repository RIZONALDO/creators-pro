import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'deve estar no formato YYYY-MM-DD');
export const shiftStatusSchema = z.enum(['scheduled', 'completed', 'cancelled']);

export const newShiftSchema = z.object({
  shift_date: isoDate,
  creator_id: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: shiftStatusSchema.optional(),
  // Sobreaviso: 0+ creators de backup, além do plantonista titular (creator_id) — recebem a mesma notificação dele.
  standby_creator_ids: z.array(z.string().uuid()).optional(),
});

// PUT não inclui status — toda mudança de status passa por PATCH /shifts/:id/status (garante status_history).
export const updateShiftSchema = z.object({
  shift_date: isoDate.optional(),
  creator_id: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  standby_creator_ids: z.array(z.string().uuid()).optional(),
});

export const setShiftStatusSchema = z.object({
  status: shiftStatusSchema,
});
