/** INSERT...RETURNING sempre devolve >=1 linha quando não lança — só o tipo do array é "unchecked". */
export function firstOrThrow<T>(rows: T[], message = 'Esperava ao menos 1 linha retornada pelo banco.'): T {
  const row = rows[0];
  if (!row) throw new Error(message);
  return row;
}
