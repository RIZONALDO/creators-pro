/** Remove password_hash antes de devolver um usuário pra fora do backend. */
export function sanitizeUser<T extends { passwordHash: string }>(user: T): Omit<T, 'passwordHash'> {
  const { passwordHash, ...safe } = user;
  return safe;
}
