/** Remove password_hash antes de devolver um usuário pra fora do backend. Null pra contas 'pending'
 * (convite só com e-mail, sem senha ainda — ver users.ts#passwordHash). */
export function sanitizeUser<T extends { passwordHash: string | null }>(user: T): Omit<T, 'passwordHash'> {
  const { passwordHash, ...safe } = user;
  return safe;
}
