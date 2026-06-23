import { z } from 'zod';

export const sendMessageSchema = z.object({
  receiver_id: z.string().uuid(),
  message: z.string().min(1).max(5000),
});
