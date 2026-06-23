import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'deve estar no formato YYYY-MM-DD');

export const reportFilterSchema = z.object({
  from: isoDate,
  to: isoDate,
  clientId: z.string().uuid().optional(),
  creatorId: z.string().uuid().optional(),
});

/** "outros serviços" (collaborator_services) é por colaborador, não por creator. */
export const serviceReportFilterSchema = z.object({
  from: isoDate,
  to: isoDate,
  clientId: z.string().uuid().optional(),
  collaboratorId: z.string().uuid().optional(),
});

export const exportReportSchema = z.object({
  from: isoDate,
  to: isoDate,
  clientId: z.string().uuid().optional(),
  creatorId: z.string().uuid().optional(),
  collaboratorId: z.string().uuid().optional(),
  type: z.enum(['monthly', 'client', 'creator', 'tasks', 'services', 'absences', 'all']),
  format: z.enum(['pdf', 'excel']),
});
