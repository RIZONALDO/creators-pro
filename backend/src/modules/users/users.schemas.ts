import { z } from 'zod';

// 'operacional' não entra aqui de propósito — toda conta operacional tem que nascer vinculada a
// um creator ou collaborator (via POST /creators ou /collaborators), nunca solta. E 'admin' também
// não — só nasce via signup/trial/provisionamento interno, nunca por aqui (um admin só pode criar
// gestor). Literal (não enum) pra rejeitar qualquer outro valor com 400, igual já rejeitava
// 'operacional' antes.
const userStatusSchema = z.enum(['active', 'inactive']);

export const newUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().nullable().optional(),
  role: z.literal('gestor'),
  status: userStatusSchema.optional(),
  password: z.string().min(8),
  // Apelido de exibição (ex.: "Coordenador", "Diretor") — livre, sobrescreve o padrão do role.
  alias: z.string().trim().min(1).max(100).nullable().optional(),
});

// Sem `role` aqui de propósito — trocar o papel de acesso de alguém não é um campo simples (ver
// users.service.ts#update, que também recusa editar quem não é gestor). `password` opcional: só
// reseta se enviado (ver users.repository.ts#updatePassword).
export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().nullable().optional(),
  status: userStatusSchema.optional(),
  alias: z.string().trim().min(1).max(100).nullable().optional(),
  password: z.string().min(8).optional(),
});
