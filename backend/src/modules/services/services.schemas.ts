import { z } from 'zod';

export const serviceStatusSchema = z.enum(['agendado', 'em_andamento', 'concluido', 'cancelado']);

export const newServiceSchema = z.object({
  service_name: z.string().min(1),
  service_date: z.string().nullable().optional(),
  service_type: z.string().nullable().optional(),
  collaborator_id: z.string().uuid().nullable().optional(),
  client_id: z.string().uuid().nullable().optional(),
  status: serviceStatusSchema.optional(),
  notes: z.string().nullable().optional(),
});

// PUT não inclui status — toda mudança de status passa por PATCH /services/:id/status (garante status_history).
export const updateServiceSchema = z.object({
  service_name: z.string().min(1).optional(),
  service_date: z.string().nullable().optional(),
  service_type: z.string().nullable().optional(),
  collaborator_id: z.string().uuid().nullable().optional(),
  client_id: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const setServiceStatusSchema = z.object({
  status: serviceStatusSchema,
});
