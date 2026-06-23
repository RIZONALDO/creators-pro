function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Converte chaves camelCase (como o Drizzle nomeia colunas em JS) pra snake_case
 * (o contrato que o frontend espera desde antes do backend existir — ver specs/02).
 * Não toca em valores (strings como "ABSENCE_OVERLAPS_SCHEDULE" ficam intactas — só
 * a CHAVE do objeto é renomeada, não o conteúdo) nem em instâncias de Date.
 */
export function toSnakeCase(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toSnakeCase);
  if (value instanceof Date) return value;
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [camelToSnake(k), toSnakeCase(v)]));
  }
  return value;
}
