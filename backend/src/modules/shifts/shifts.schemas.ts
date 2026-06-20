import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'deve estar no formato YYYY-MM-DD');
export const shiftStatusSchema = z.enum(['pending', 'confirmed', 'completed', 'cancelled']);

export const newShiftSchema = z.object({
  shift_date: isoDate,
  creator_id: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: shiftStatusSchema.optional(),
});

// PUT não inclui status — toda mudança de status passa por PATCH /shifts/:id/status (garante status_history).
export const updateShiftSchema = z.object({
  shift_date: isoDate.optional(),
  creator_id: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const setShiftStatusSchema = z.object({
  status: shiftStatusSchema,
});
