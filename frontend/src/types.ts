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
// 'pending': conta criada só com e-mail (sem senha) — login só via Google até a primeira
// autenticação, que captura nome/foto reais e ativa a conta (ver lib/display.ts#roleLabel e
// screens/Login.tsx#GoogleSignInButton).
export type UserStatus = 'active' | 'inactive' | 'pending';

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

/** shifts.status — 'pending'/'confirmed' existiam antes mas nunca tiveram função real (ver specs/06); simplificado pra 3 estados com desfecho real. */
export type ShiftStatus = 'scheduled' | 'completed' | 'cancelled';

/** notifications.type (VARCHAR — convenção do frontend) */
export type NotificationType =
  | 'nova_tarefa' | 'mudanca_status' | 'ausencia_aprovada'
  | 'ausencia_rejeitada' | 'novo_plantao' | 'alteracao_escala' | 'registro_tarefa';

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
  // Foto do Google (login com Google) — null até o primeiro login com Google, ou se a conta nunca usou Google.
  avatar_url: string | null;
  // Função/cargo digitado pelo admin (ex.: "Diretor", "Supervisor") — texto livre e opcional, só
  // admin/gestor; sem valor cadastrado, a UI cai pro nome do tipo de acesso (Gestor/Admin), nunca
  // assume um cargo específico. Operacional usa Creator/Colaborador (estrutural, não texto livre).
  alias?: string | null;
  // resolvido só por /auth/me (não é coluna de users) — operacional usa pra filtrar a própria escala.
  creator_id?: string | null;
  // resolvido por /auth/me, /auth/login e GET /users (admin) — distingue Creator de Colaborador
  // dentro de role='operacional'.
  collaborator_id?: string | null;
  // resolvido junto com collaborator_id — a profissão real cadastrada (ex.: "Editor de Vídeo"),
  // não um rótulo genérico. Null se não for colaborador.
  profession?: string | null;
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
  // vem via LEFT JOIN só em GET /tasks (não é coluna) — existe pro operacional ver o nome do
  // cliente sem precisar de acesso a GET /clients, que o RBAC bloqueia pra esse papel.
  client_name: string | null;
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
  creator_id: string | null;    // FK -> creators.id (plantonista titular)
  creator_name: string | null;  // resolvido pela API — operacional não tem GET /creators pra resolver sozinho
  standby_creator_ids: string[]; // FKs -> creators.id (sobreaviso — recebem a mesma notificação do titular)
  standby_names: string[];      // paralelo a standby_creator_ids, mesmo motivo de creator_name
  notes: string | null;
  status: ShiftStatus;
  created_by: string;           // FK -> users.id
  created_at: string;
}

/** status_history — polimórfica, cobre task/absence/shift/service (ver specs/02) */
export type HistoryEntity = 'task' | 'absence' | 'shift' | 'service';
export interface StatusHistoryEntry {
  id: string;
  entity_type: HistoryEntity;
  entity_id: string;
  old_status: string | null;
  new_status: string | null;
  changed_by: string;            // FK -> users.id
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

/** attachments — anexos polimórficos de tarefas/serviços/ausências/plantões/mensagens. */
export interface Attachment {
  id: string;
  file_name: string | null;
  file_url: string;             // key de storage local, não uma URL pública — baixar sempre via GET /attachments/:id/file
  mime_type: string | null;
  size_bytes: number | null;
  entity_type: AttachmentEntity;
  entity_id: string;
  uploaded_by: string;          // FK -> users.id
  created_at: string;
}

/** companies.status — controlado pelo webhook do Stripe (ver billing.service.ts), nunca pelo frontend. */
export type CompanyStatus = 'active' | 'suspended' | 'cancelled';

/** company_settings — 1 linha por tenant; GET liberado a qualquer autenticado, PUT só admin.
 * Dois grupos: dados da empresa (display_name/logo_url — só organizacional) e dados do app
 * (app_name/app_subtitle/timezone/locale — como o produto se apresenta/comporta pro tenant). */
export interface CompanySettings {
  tenant_id: string;
  display_name: string | null;
  logo_url: string | null;
  app_name: string | null;
  app_subtitle: string | null;
  timezone: string;
  locale: string;
  updated_at: string | null;
}

/* ============================ VIEWS (JOINs para a UI) ============================ */

/** creators JOIN users — o backend retorna name/email/phone do usuário vinculado. */
export interface Creator extends CreatorRow {
  name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  // 'pending' = convite só com e-mail, aguardando o primeiro login com Google — distinto do
  // `active` de CreatorRow (esse é "ativo na escala/produção", outro conceito).
  status: UserStatus;
  // Token cru do link de convite (/convite/<token>) — só vem preenchido na resposta do POST que
  // criou a conta pending; nunca aparece de novo em GET /creators (só o hash fica salvo).
  invite_token?: string;
}

/** collaborators JOIN users */
export interface Collaborator extends CollaboratorRow {
  name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  status: UserStatus;
  invite_token?: string;
}

/** Conversa derivada (NÃO é tabela): agrupamento de messages por par de usuários. */
export interface Conversation {
  user_id: string;              // o outro participante
  last_message: string;
  last_at: string;
  unread: number;
}

/** Com quem dá pra começar uma conversa nova — resolvido pelo papel (operacional vê a coordenação, coordenador vê os creators). */
export interface MessageContact {
  user_id: string;
  name: string;
}

/* ============================ REPORTS (agregado, não é tabela) ============================ */

export interface ReportFilterParams {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  clientId?: string | null;
  creatorId?: string | null;
  collaboratorId?: string | null; // só pra listagem de "outros serviços" — collaborator_services não tem creator_id
}

export interface ProductionMonthlyRow { month: string; count: number; }
export interface ProductionByClientRow { client_id: string; client_name: string; count: number; }
export interface ProductionByCreatorRow { creator_id: string; creator_name: string; count: number; }
export interface ShiftsCompletedReport { total: number; by_creator: { creator_id: string; creator_name: string; count: number }[]; }
export interface AbsencesReportSummary {
  total: number;
  by_status: { status: string; count: number }[];
  by_creator: { creator_id: string; creator_name: string; count: number }[];
}
export interface ApprovedDeliveriesReport { total: number; approved: number; rate: number; }

/**
 * Listagem completa (não agregada) — relatório em formato de planilha, com nomes já resolvidos
 * pelo backend. `responsible_name` = o gestor/coordenador que liderou (criou a tarefa/serviço, ou
 * revisou a ausência) — não é o creator/colaborador que executa.
 */
export interface TaskReportRow {
  id: string;
  title: string;
  format_type: TaskFormat | null;
  task_date: string | null;
  status: TaskStatus;
  description: string | null;
  client_name: string | null;
  creator_name: string | null;
  responsible_name: string | null;
}

export interface ServiceReportRow {
  id: string;
  service_name: string;
  service_type: string | null;
  service_date: string | null;
  status: ServiceStatus | string;
  notes: string | null;
  client_name: string | null;
  collaborator_name: string | null;
  responsible_name: string | null;
}

export interface AbsenceReportRow {
  id: string;
  creator_name: string | null;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: AbsenceStatus;
  responsible_name: string | null;
  approved_at: string | null;
}

/* ============================ AUXILIARES DE UI ============================ */

export interface StatusMeta { label: string; color: string; bg: string; }

export interface AuthSession {
  token: string;
  refresh_token: string;
  user: User;
}

/* ============================ PAYLOADS DE CRIAÇÃO ============================ */

// 'operacional' não é uma opção aqui de propósito — essa conta só nasce vinculada a um creator ou
// collaborator (ver NewCreator/NewCollaborator), nunca solta.
export type NewUser = Pick<User, 'name' | 'email' | 'phone' | 'status' | 'alias'> & { role: 'admin' | 'gestor'; password: string };
/** creator: cria users + creators. O backend separa nas duas tabelas.
 * name/password opcionais: omitir os dois cria um convite "pendente" — a pessoa entra com Google na
 * primeira vez, que captura nome/foto reais e ativa a conta (ver specs — login com Google). */
export type NewCreator = { name?: string; email: string | null; phone: string | null; employment_type: EmploymentType; active: boolean; password?: string };
export type NewCollaborator = { name?: string; email: string | null; phone: string | null; profession: string; employment_type: EmploymentType; active: boolean; password?: string };
export type NewClient = Pick<Client, 'name' | 'active'>;
export type NewTask = Pick<CreatorTask, 'title' | 'format_type' | 'task_date' | 'creator_id' | 'client_id' | 'status' | 'description'>;
export type NewService = Pick<ServiceRow, 'service_name' | 'service_type' | 'collaborator_id' | 'client_id' | 'service_date' | 'status' | 'notes'>;
// creator_id é opcional: operacional não informa (o backend resolve pelo próprio token, já
// que ele não tem acesso a GET /creators pra descobrir o id); admin/gestor precisa informar.
export type NewAbsence = Pick<Absence, 'start_date' | 'end_date' | 'reason'> & { creator_id?: string };
export type NewShift = Pick<Shift, 'shift_date' | 'creator_id' | 'notes' | 'status'> & { standby_creator_ids?: string[] };
