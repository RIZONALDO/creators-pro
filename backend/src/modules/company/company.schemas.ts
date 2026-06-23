import { z } from 'zod';

export const updateCompanySettingsSchema = z.object({
  display_name: z.string().trim().min(1).max(255).nullable().optional(),
  logo_url: z.string().url().nullable().optional(),
  app_name: z.string().trim().min(1).max(255).nullable().optional(),
  app_subtitle: z.string().trim().min(1).max(255).nullable().optional(),
  timezone: z.string().min(1).max(50).optional(),
  locale: z.string().min(1).max(10).optional(),
});
