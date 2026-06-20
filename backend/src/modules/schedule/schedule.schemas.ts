import { z } from 'zod';

export const assignCreatorSchema = z.object({
  creator_id: z.string().uuid().nullable(),
});

export const duplicateMonthSchema = z.object({
  target_month: z.number().int().min(1).max(12),
  target_year: z.number().int().min(2000).max(2100),
});

export const newHolidaySchema = z.object({
  holiday_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'holiday_date deve estar no formato YYYY-MM-DD'),
  description: z.string().nullable().optional(),
});
