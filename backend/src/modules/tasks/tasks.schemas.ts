import { z } from 'zod';

export const taskFormatSchema = z.enum([
  'Story',
  'Reels',
  'Story/Reels',
  'Select',
  'Edição',
  'Sonora',
  'Banco',
  'Aftermovie',
  'Captação',
  'Roteiro',
]);

export const taskStatusSchema = z.enum([
  'na_fila',
  'em_edicao',
  'no_servidor',
  'em_aprovacao',
  'em_alteracao',
  'falta_captacao',
  'aprovado',
  'reprovado',
  'cancelado',
]);

export const newTaskSchema = z.object({
  title: z.string().min(1),
  format_type: taskFormatSchema.nullable().optional(),
  task_date: z.string().nullable().optional(),
  creator_id: z.string().uuid().nullable().optional(),
  client_id: z.string().uuid().nullable().optional(),
  status: taskStatusSchema.optional(),
  description: z.string().nullable().optional(),
});

// PUT não inclui status — toda mudança de status passa por PATCH /tasks/:id/status (garante status_history).
export const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  format_type: taskFormatSchema.nullable().optional(),
  task_date: z.string().nullable().optional(),
  creator_id: z.string().uuid().nullable().optional(),
  client_id: z.string().uuid().nullable().optional(),
  description: z.string().nullable().optional(),
});

export const setTaskStatusSchema = z.object({
  status: taskStatusSchema,
});
