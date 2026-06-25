/**
 * Metadados de exibição derivados dos enums do schema.
 * Mantém num só lugar as cores/labels usadas em badges, pílulas de status, etc.
 */
import type {
  TaskFormat, TaskStatus, ServiceStatus,
  AbsenceStatus, ShiftStatus, StatusMeta, UserRole, UserStatus, CompanyStatus, User,
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

export const SERVICE_TYPE_COLOR: Record<string, string> = {
  drone: '#22C55E', foto: '#06B6D4', edicao: '#8B5CF6', sonora: '#FB923C', outros: '#9A9AB2',
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
  scheduled: { label: 'Agendado',  color: '#22C55E', bg: 'rgba(34,197,94,.16)' },
  completed: { label: 'Realizado', color: '#06B6D4', bg: 'rgba(6,182,212,.16)' },
  cancelled: { label: 'Cancelado', color: '#65657C', bg: 'rgba(101,101,124,.14)' },
};

// label aqui é o nome do papel de acesso (RBAC), não a função/cargo da pessoa — "Coordenador" não
// é um sinônimo fixo de "gestor", é só uma função possível entre outras (specs/06). Default só pra
// quando não há função real cadastrada — roleLabel() abaixo é quem decide o texto de verdade.
// Cor/fundo continuam por role (não tem sentido cor por função).
export const ROLE_META: Record<UserRole, StatusMeta> = {
  admin:       { label: 'Admin',       color: '#8B5CF6', bg: 'rgba(139,92,246,.16)' },
  gestor:      { label: 'Gestor',      color: '#6C63FF', bg: 'rgba(108,99,255,.16)' },
  operacional: { label: 'Operacional', color: '#06B6D4', bg: 'rgba(6,182,212,.16)' },
};

/** Único lugar que decide que texto mostrar pra função/cargo de uma pessoa — nunca um rótulo de
 * role cravado direto numa tela, e nunca assume "Coordenador" pra ninguém que não tenha essa
 * função de fato cadastrada. Prioridade: 1) função digitada pelo admin (admin/gestor) 2) profissão
 * real cadastrada (colaborador) 3) nome do papel de acesso, só quando nada foi cadastrado ainda. */
export function roleLabel(user: Pick<User, 'role' | 'alias' | 'collaborator_id' | 'profession'>): string {
  if (user.alias) return user.alias;
  if (user.profession) return user.profession;
  if (user.role === 'operacional') return user.collaborator_id ? 'Colaborador' : 'Creator';
  return ROLE_META[user.role].label;
}

// 'pending' = conta criada só com e-mail, aguardando o primeiro login com Google (não é "Inativo" —
// inativo é uma desativação explícita do admin, pending é só "ainda não fez o primeiro acesso").
export const USER_STATUS_META: Record<UserStatus, StatusMeta> = {
  active:   { label: 'Ativo',    color: '#22C55E', bg: 'rgba(34,197,94,.16)' },
  inactive: { label: 'Inativo',  color: '#65657C', bg: 'rgba(101,101,124,.14)' },
  pending:  { label: 'Pendente', color: '#F59E0B', bg: 'rgba(245,158,11,.16)' },
};

export const COMPANY_STATUS_META: Record<CompanyStatus, StatusMeta> = {
  active:    { label: 'Ativa',     color: '#22C55E', bg: 'rgba(34,197,94,.16)' },
  suspended: { label: 'Suspensa',  color: '#F59E0B', bg: 'rgba(245,158,11,.16)' },
  cancelled: { label: 'Cancelada', color: '#EF4444', bg: 'rgba(239,68,68,.16)' },
  trial:     { label: 'Teste',     color: '#6C63FF', bg: 'rgba(108,99,255,.16)' },
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

/** '2026-06-18T09:42:00Z' -> '09:42' (hoje) ou '18 jun' (outro dia) — usado nas notificações. */
export function shortTime(iso: string): string {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  if (sameDay) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return shortDate(iso.slice(0, 10));
}

const FULL_MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
/** '2026-06' -> 'Junho 2026' */
export function monthLabel(yyyyMM: string): string {
  const [y, m] = yyyyMM.split('-').map(Number);
  return `${FULL_MONTHS[m - 1]} ${y}`;
}

export function formatFileSize(bytes: number | null): string {
  if (bytes === null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
