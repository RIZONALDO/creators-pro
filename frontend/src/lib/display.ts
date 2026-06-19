/**
 * Metadados de exibição derivados dos enums do schema.
 * Mantém num só lugar as cores/labels usadas em badges, pílulas de status, etc.
 */
import type {
  TaskFormat, TaskStatus, ServiceStatus,
  AbsenceStatus, ShiftStatus, StatusMeta, UserRole,
} from '@/types';

export const TASK_STATUS_META: Record<TaskStatus, StatusMeta> = {
  na_fila:        { label: 'Na fila',        color: '#9A9AB2', bg: 'rgba(154,154,178,.14)' },
  falta_captacao: { label: 'Falta captação', color: '#EF4444', bg: 'rgba(239,68,68,.15)' },
  em_edicao:      { label: 'Em edição',      color: '#8B5CF6', bg: 'rgba(139,92,246,.16)' },
  no_servidor:    { label: 'No servidor',    color: '#06B6D4', bg: 'rgba(6,182,212,.16)' },
  em_aprovacao:   { label: 'Em aprovação',   color: '#F59E0B', bg: 'rgba(245,158,11,.16)' },
  em_alteracao:   { label: 'Em alteração',   color: '#FB923C', bg: 'rgba(251,146,60,.16)' },
  aprovado:       { label: 'Aprovado',       color: '#22C55E', bg: 'rgba(34,197,94,.16)' },
  reprovado:      { label: 'Reprovado',      color: '#EF4444', bg: 'rgba(239,68,68,.16)' },
  cancelado:      { label: 'Cancelado',      color: '#65657C', bg: 'rgba(101,101,124,.14)' },
};

/** Ordem das colunas do kanban */
export const TASK_STATUS_ORDER: TaskStatus[] = [
  'na_fila', 'falta_captacao', 'em_edicao', 'no_servidor',
  'em_aprovacao', 'em_alteracao', 'aprovado', 'reprovado', 'cancelado',
];

export const TASK_FORMAT_COLOR: Record<TaskFormat, string> = {
  'Story': '#6C63FF', 'Reels': '#8B5CF6', 'Story/Reels': '#EC4899', 'Select': '#06B6D4',
  'Edição': '#22C55E', 'Sonora': '#FB923C', 'Banco': '#14B8A6', 'Aftermovie': '#F59E0B',
  'Captação': '#EF4444', 'Roteiro': '#06B6D4',
};

/** collaborator_services.service_type é VARCHAR; estes são os valores convencionados. */
export const SERVICE_TYPE_LABEL: Record<string, string> = {
  drone: 'Operador de Drone', foto: 'Fotógrafo', edicao: 'Editor', sonora: 'Sonoplasta', outros: 'Outros',
};

export const SERVICE_STATUS_META: Record<string, StatusMeta> = {
  agendado:     { label: 'Agendado',     color: '#9A9AB2', bg: 'rgba(154,154,178,.14)' },
  em_andamento: { label: 'Em andamento', color: '#8B5CF6', bg: 'rgba(139,92,246,.16)' },
  concluido:    { label: 'Concluído',    color: '#22C55E', bg: 'rgba(34,197,94,.16)' },
  cancelado:    { label: 'Cancelado',    color: '#65657C', bg: 'rgba(101,101,124,.14)' },
};

export const ABSENCE_STATUS_META: Record<AbsenceStatus, StatusMeta> = {
  pending:  { label: 'Pendente',  color: '#F59E0B', bg: 'rgba(245,158,11,.16)' },
  approved: { label: 'Aprovado',  color: '#22C55E', bg: 'rgba(34,197,94,.16)' },
  rejected: { label: 'Rejeitado', color: '#EF4444', bg: 'rgba(239,68,68,.16)' },
};

export const SHIFT_STATUS_META: Record<ShiftStatus, StatusMeta> = {
  pending:   { label: 'Pendente',   color: '#F59E0B', bg: 'rgba(245,158,11,.16)' },
  confirmed: { label: 'Confirmado', color: '#22C55E', bg: 'rgba(34,197,94,.16)' },
  completed: { label: 'Realizado',  color: '#06B6D4', bg: 'rgba(6,182,212,.16)' },
  cancelled: { label: 'Cancelado',  color: '#65657C', bg: 'rgba(101,101,124,.14)' },
};

export const ROLE_META: Record<UserRole, StatusMeta> = {
  admin:       { label: 'Admin',       color: '#8B5CF6', bg: 'rgba(139,92,246,.16)' },
  gestor:      { label: 'Coordenador', color: '#6C63FF', bg: 'rgba(108,99,255,.16)' },
  operacional: { label: 'Operacional', color: '#06B6D4', bg: 'rgba(6,182,212,.16)' },
};

/** Paleta determinística para avatares, derivada do id/nome. */
const AVATAR_COLORS = ['#6C63FF', '#8B5CF6', '#14B8A6', '#06B6D4', '#22C55E', '#F59E0B', '#EC4899', '#FB923C'];
export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

/** '2026-06-18' -> '18 jun' */
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export function shortDate(iso: string | null): string {
  if (!iso) return '—';
  const [, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')} ${MONTHS[m - 1]}`;
}
