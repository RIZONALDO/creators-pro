/**
 * Espelha a matriz RBAC de specs/03-autenticacao-multitenancy.md — o backend já aplica isso
 * de verdade via 403; isto aqui é só pra UI parar de oferecer ação que vai falhar.
 */
import { useApp } from '@/context/AppContext';
import type { UserRole } from '@/types';

export type ManageableResource = 'tasks' | 'services' | 'schedule' | 'shifts' | 'cadastros' | 'absences-review';

const MANAGE_ROLES: Record<ManageableResource, UserRole[]> = {
  tasks: ['admin', 'gestor'],
  services: ['admin', 'gestor'],
  schedule: ['admin', 'gestor'],
  shifts: ['admin', 'gestor'],
  cadastros: ['admin', 'gestor'],
  'absences-review': ['admin', 'gestor'],
};

export function canManage(role: UserRole | undefined, resource: ManageableResource): boolean {
  if (!role) return false;
  return MANAGE_ROLES[resource].includes(role);
}

export function useCan(resource: ManageableResource): boolean {
  const { user } = useApp();
  return canManage(user?.role, resource);
}
