import { z } from 'zod';

export const attachmentEntityTypeSchema = z.enum(['task', 'service', 'absence', 'shift', 'message']);

export const attachmentEntityRefSchema = z.object({
  entity_type: attachmentEntityTypeSchema,
  entity_id: z.string().uuid(),
});
