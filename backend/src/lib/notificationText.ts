const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** '2026-06-18' -> '18 jun' — mesmo formato do frontend (lib/display.ts#shortDate). Sem isso, a
 * notificação mostrava data crua tipo "2026-06-18 – 2026-06-22" pro usuário final. */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')} ${MONTHS[m! - 1]!}`;
}

/** Espelha TASK_STATUS_META do frontend (lib/display.ts) — mesmas labels, só que aqui pro texto
 * da notificação de 'mudanca_status' (antes não dizia qual era o novo status, só o título da tarefa). */
export const TASK_STATUS_LABEL: Record<string, string> = {
  na_fila: 'Na fila',
  falta_captacao: 'Falta captação',
  em_edicao: 'Em edição',
  no_servidor: 'No servidor',
  em_aprovacao: 'Em aprovação',
  em_alteracao: 'Em alteração',
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
  cancelado: 'Cancelado',
};
