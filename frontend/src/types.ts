/**
 * CreatorsPro — modelo de dados
 * Tipos TypeScript FIÉIS ao schema PostgreSQL do backend (1:1 com cada CREATE TABLE).
 *
 * Convenção:
 *  - Os enums em inglês (pending/approved/…) refletem os valores aceitos no banco.
 *  - As interfaces "*Row" mapeiam exatamente as colunas da tabela.
 *  - As interfaces "*View" são o shape que a API devolve para a UI quando há JOIN
 *    (ex.: creators + users para trazer o nome). O backend monta isso via JOIN;
 *    o frontend nunca inventa colunas que não existem na tabela.
 */

/* ============================ ENUMS ============================ */

export type UserRole = 'admin' | 'gestor' | 'operacional';
export type UserStatus = 'active' | 'inactive';

/** creators.employment_type / collaborators.employment_type */
export type EmploymentType = 'fixed' | 'freelancer';

/** creator_tasks.format_type */
export type TaskFormat =
  | 'Story' | 'Reels' | 'Story/Reels' | 'Select' | 'Edição'
  | 'Sonora' | 'Banco' | 'Aftermovie' | 'Captação' | 'Roteiro';

/** creator_tasks.status */
export type TaskStatus =
  | 'na_fila' | 'em_edicao' | 'no_servidor' | 'em_aprovacao' | 'em_alteracao'
  | 'falta_captacao' | 'aprovado' | 'reprovado' | 'cancelado';

/** collaborator_services.status (VARCHAR — convenção do frontend) */
export type ServiceStatus = 'agendado' | 'em_andamento' | 'concluido' | 'cancelado';

/** absences.status */
export type AbsenceStatus = 'pending' | 'approved' | 'rejected';

/** shifts.status */
export type ShiftStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

/** notifications.type (VARCHAR — convenção do frontend) */
export type NotificationType =
  | 'nova_tarefa' | 'mudanca_status' | 'ausencia_aprovada'
  | 'ausencia_rejeitada' | 'novo_plantao' | 'alteracao_escala';

/** attachments.entity_type */
export type AttachmentEntity = 'task' | 'service' | 'absence' | 'message' | 'shift';

/* ============================ TABELAS (Rows) ============================ */

/** users */
export interface User {
  id: string;            // UUID
  name: string;
  email: string;
  phone: string | null;
  // password_hash: TEXT — NUNCA exposto ao frontend
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

/** creators — vínculo 1:1 com users (user_id UNIQUE NOT NULL) */
export interface CreatorRow {
  id: string;
  user_id: string;
  employment_type: EmploymentType | null;
  active: boolean;
  created_at: string;
}

/** collaborators — profession é VARCHAR(100) (não é tabela) */
export interface CollaboratorRow {
  id: string;
  user_id: string;
  profession: string | null;
  employment_type: EmploymentType | null;
  active: boolean;
  created_at: string;
}

/** clients */
export interface Client {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
}

/** creator_tasks */
export interface CreatorTask {
  id: string;
  title: string;
  format_type: TaskFormat | null;
  task_date: string | null;     // DATE
  creator_id: string | null;    // FK -> creators.id
  client_id: string | null;     // FK -> clients.id
  status: TaskStatus;
  description: string | null;
  created_by: string;           // FK -> users.id
  created_at: string;
  updated_at: string;
}

/** collaborator_services */
export interface ServiceRow {
  id: string;
  service_name: string;
  service_date: string | null;  // DATE
  service_type: string | null;  // VARCHAR(100)
  collaborator_id: string | null;
  client_id: string | null;
  status: ServiceStatus | string;
  notes: string | null;
  created_by: string;
  created_at: string;
}

/** scale_months — controle mensal de escalas */
export interface ScaleMonth {
  id: string;
  month: number;                // 1-12
  year: number;
  created_by: string;
  created_at: string;
}

/** scale_entries — dias escalados */
export interface ScaleEntry {
  id: string;
  scale_month_id: string;       // FK -> scale_months.id
  creator_id: string | null;    // FK -> creators.id
  work_date: string;            // DATE
  is_holiday: boolean;
  created_at: string;
}

/** holidays */
export interface Holiday {
  id: string;
  holiday_date: string;         // DATE
  description: string | null;
}

/** absences */
export interface Absence {
  id: string;
  creator_id: string;           // FK -> creators.id
  start_date: string;           // DATE
  end_date: string;             // DATE
  reason: string | null;
  status: AbsenceStatus;
  approved_by: string | null;   // FK -> users.id
  approved_at: string | null;   // TIMESTAMP
  created_at: string;
}

/** shifts — plantões (somente creators) */
export interface Shift {
  id: string;
  shift_date: string;           // DATE
  creator_id: string | null;    // FK -> creators.id
  notes: string | null;
  status: ShiftStatus;
  created_by: string;           // FK -> users.id
  created_at: string;
}

/** task_status_history */
export interface TaskStatusHistory {
  id: string;
  task_id: string;              // FK -> creator_tasks.id
  old_status: TaskStatus | null;
  new_status: TaskStatus | null;
  changed_by: string;           // FK -> users.id
  changed_at: string;
}

/** messages — chat interno */
export interface Message {
  id: string;
  sender_id: string;            // FK -> users.id
  receiver_id: string;          // FK -> users.id
  message: string;
  is_read: boolean;
  created_at: string;
}

/** notifications */
export interface Notification {
  id: string;
  user_id: string;              // FK -> users.id (destinatário)
  title: string | null;
  description: string | null;
  type: NotificationType | string;
  is_read: boolean;
  created_at: string;
}

/** attachments — anexos polimórficos de tarefas/serviços/etc. */
export interface Attachment {
  id: string;
  file_name: string | null;
  file_url: string | null;
  entity_type: AttachmentEntity | string;
  entity_id: string;
  uploaded_by: string;          // FK -> users.id
  created_at: string;
}

/* ============================ VIEWS (JOINs para a UI) ============================ */

/** creators JOIN users — o backend retorna name/email/phone do usuário vinculado. */
export interface Creator extends CreatorRow {
  name: string;
  email: string | null;
  phone: string | null;
}

/** collaborators JOIN users */
export interface Collaborator extends CollaboratorRow {
  name: string;
  email: string | null;
  phone: string | null;
}

/** Conversa derivada (NÃO é tabela): agrupamento de messages por par de usuários. */
export interface Conversation {
  user_id: string;              // o outro participante
  last_message: string;
  last_at: string;
  unread: number;
}

/* ============================ AUXILIARES DE UI ============================ */

export interface StatusMeta { label: string; color: string; bg: string; }

export interface AuthSession {
  token: string;
  user: User;
}

/* ============================ PAYLOADS DE CRIAÇÃO ============================ */

export type NewUser = Pick<User, 'name' | 'email' | 'phone' | 'role' | 'status'> & { password: string };
/** creator: cria users + creators. O backend separa nas duas tabelas. */
export type NewCreator = { name: string; email: string | null; phone: string | null; employment_type: EmploymentType; active: boolean };
export type NewCollaborator = { name: string; email: string | null; phone: string | null; profession: string; employment_type: EmploymentType; active: boolean };
export type NewClient = Pick<Client, 'name' | 'active'>;
export type NewTask = Pick<CreatorTask, 'title' | 'format_type' | 'task_date' | 'creator_id' | 'client_id' | 'status' | 'description'>;
export type NewService = Pick<ServiceRow, 'service_name' | 'service_type' | 'collaborator_id' | 'client_id' | 'service_date' | 'status' | 'notes'>;
export type NewAbsence = Pick<Absence, 'creator_id' | 'start_date' | 'end_date' | 'reason'>;
export type NewShift = Pick<Shift, 'shift_date' | 'creator_id' | 'notes' | 'status'>;
