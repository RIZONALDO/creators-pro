import { z } from 'zod';

// 'operacional' não entra aqui de propósito — toda conta operacional tem que nascer vinculada a
// um creator ou collaborator (via POST /creators ou /collaborators), nunca solta. /users serve só
// contas admin/coordenador.
const userRoleSchema = z.enum(['admin', 'gestor']);
const userStatusSchema = z.enum(['active', 'inactive']);

export const newUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().nullable().optional(),
  role: userRoleSchema,
  status: userStatusSchema.optional(),
  password: z.string().min(8),
  // Apelido de exibição (ex.: "Coordenador", "Diretor") — livre, sobrescreve o padrão do role.
  alias: z.string().trim().min(1).max(100).nullable().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().nullable().optional(),
  role: userRoleSchema.optional(),
  status: userStatusSchema.optional(),
  alias: z.string().trim().min(1).max(100).nullable().optional(),
});
