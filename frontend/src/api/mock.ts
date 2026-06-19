/**
 * Dados mock em memória — fiéis ao schema PostgreSQL.
 * Usados quando VITE_USE_MOCK=true. Troque a flag para usar o backend.
 *
 * Para creators/collaborators os arrays já trazem o JOIN com users (name/email/phone),
 * que é o shape que a API devolve (Creator/Collaborator = *Row + dados do usuário).
 */
import type {
  User, Creator, Collaborator, Client, CreatorTask, ServiceRow,
  ScaleMonth, ScaleEntry, Holiday, Absence, Shift, Conversation, Message, Notification,
} from '@/types';

const now = '2026-06-18T12:00:00Z';

export const users: User[] = [
  { id: 'u1', name: 'Carlos Andrade', email: 'carlos@studionorte.com', phone: '(96) 99100-2030', role: 'admin', status: 'active', created_at: '2026-02-02T10:00:00Z', updated_at: now },
  { id: 'u2', name: 'Fernanda Lima', email: 'fernanda@studionorte.com', phone: '(96) 99444-1010', role: 'gestor', status: 'active', created_at: '2026-02-05T10:00:00Z', updated_at: now },
  { id: 'u3', name: 'Mariana Lopes', email: 'mariana@studionorte.com', phone: '(96) 98888-2020', role: 'operacional', status: 'active', created_at: '2026-03-01T10:00:00Z', updated_at: now },
  { id: 'u4', name: 'João Pedro', email: 'joao@studionorte.com', phone: null, role: 'operacional', status: 'active', created_at: now, updated_at: now },
  { id: 'u5', name: 'Aline Costa', email: 'aline@studionorte.com', phone: null, role: 'operacional', status: 'active', created_at: now, updated_at: now },
  { id: 'u6', name: 'Rafael Souza', email: 'rafael@studionorte.com', phone: null, role: 'operacional', status: 'active', created_at: now, updated_at: now },
  { id: 'u7', name: 'Bruno Tavares', email: 'bruno@studionorte.com', phone: null, role: 'operacional', status: 'active', created_at: now, updated_at: now },
  { id: 'u8', name: 'Camila Reis', email: 'camila@studionorte.com', phone: null, role: 'operacional', status: 'active', created_at: now, updated_at: now },
  { id: 'u9', name: 'Larissa Maia', email: 'larissa@studionorte.com', phone: null, role: 'operacional', status: 'active', created_at: now, updated_at: now },
  { id: 'u10', name: 'Diego Alves', email: 'diego@studionorte.com', phone: null, role: 'operacional', status: 'active', created_at: now, updated_at: now },
];

/** collaborators.profession é VARCHAR — lista de valores usados (não é tabela). */
export const PROFESSIONS = ['Creator', 'Fotógrafo', 'Operador de Drone', 'Editor', 'Sonoplasta', 'Roteirista', 'Outros'];

/** creators (JOIN users → name/email/phone) */
export const creators: Creator[] = [
  { id: 'ml', user_id: 'u3', employment_type: 'fixed', active: true, created_at: now, name: 'Mariana Lopes', email: 'mariana@studionorte.com', phone: null },
  { id: 'jp', user_id: 'u4', employment_type: 'fixed', active: true, created_at: now, name: 'João Pedro', email: 'joao@studionorte.com', phone: null },
  { id: 'ac', user_id: 'u5', employment_type: 'freelancer', active: true, created_at: now, name: 'Aline Costa', email: 'aline@studionorte.com', phone: null },
];

/** collaborators (JOIN users) */
export const collaborators: Collaborator[] = [
  { id: 'rs', user_id: 'u6', profession: 'Fotógrafo', employment_type: 'freelancer', active: true, created_at: now, name: 'Rafael Souza', email: 'rafael@studionorte.com', phone: null },
  { id: 'bt', user_id: 'u7', profession: 'Operador de Drone', employment_type: 'fixed', active: true, created_at: now, name: 'Bruno Tavares', email: 'bruno@studionorte.com', phone: null },
  { id: 'cr', user_id: 'u8', profession: 'Editor', employment_type: 'fixed', active: true, created_at: now, name: 'Camila Reis', email: 'camila@studionorte.com', phone: null },
  { id: 'lm', user_id: 'u9', profession: 'Roteirista', employment_type: 'freelancer', active: true, created_at: now, name: 'Larissa Maia', email: 'larissa@studionorte.com', phone: null },
  { id: 'da', user_id: 'u10', profession: 'Sonoplasta', employment_type: 'freelancer', active: true, created_at: now, name: 'Diego Alves', email: 'diego@studionorte.com', phone: null },
];

export const clients: Client[] = [
  { id: 'c1', name: 'Governo do Amapá', active: true, created_at: now },
  { id: 'c2', name: 'Clínica XYZ', active: true, created_at: now },
  { id: 'c3', name: 'Empresa ABC', active: true, created_at: now },
  { id: 'c4', name: 'Studio Norte', active: true, created_at: now },
  { id: 'c5', name: 'Prefeitura de Macapá', active: false, created_at: now },
];

export const tasks: CreatorTask[] = [
  { id: 't1', title: 'Cobertura inauguração — Story', format_type: 'Story', task_date: '2026-06-18', creator_id: 'ml', client_id: 'c1', status: 'na_fila', description: null, created_by: 'u2', created_at: now, updated_at: now },
  { id: 't2', title: 'Reels institucional Q2', format_type: 'Reels', task_date: '2026-06-18', creator_id: 'jp', client_id: 'c2', status: 'em_edicao', description: null, created_by: 'u2', created_at: now, updated_at: now },
  { id: 't3', title: 'Aftermovie evento anual', format_type: 'Aftermovie', task_date: '2026-06-19', creator_id: 'cr', client_id: 'c4', status: 'no_servidor', description: null, created_by: 'u2', created_at: now, updated_at: now },
  { id: 't4', title: 'Captação aérea da orla', format_type: 'Captação', task_date: '2026-06-19', creator_id: 'bt', client_id: 'c5', status: 'falta_captacao', description: null, created_by: 'u2', created_at: now, updated_at: now },
  { id: 't5', title: 'Pacote Story + Reels lançamento', format_type: 'Story/Reels', task_date: '2026-06-20', creator_id: 'ac', client_id: 'c3', status: 'em_aprovacao', description: null, created_by: 'u2', created_at: now, updated_at: now },
  { id: 't6', title: 'Edição vídeo institucional', format_type: 'Edição', task_date: '2026-06-20', creator_id: 'cr', client_id: 'c1', status: 'em_alteracao', description: null, created_by: 'u2', created_at: now, updated_at: now },
  { id: 't7', title: 'Reels bastidores', format_type: 'Reels', task_date: '2026-06-17', creator_id: 'ml', client_id: 'c4', status: 'aprovado', description: null, created_by: 'u2', created_at: now, updated_at: now },
  { id: 't8', title: 'Trilha e mixagem podcast', format_type: 'Sonora', task_date: '2026-06-21', creator_id: 'da', client_id: 'c2', status: 'na_fila', description: null, created_by: 'u2', created_at: now, updated_at: now },
  { id: 't9', title: 'Roteiro campanha junho', format_type: 'Roteiro', task_date: '2026-06-21', creator_id: 'lm', client_id: 'c3', status: 'em_edicao', description: null, created_by: 'u2', created_at: now, updated_at: now },
  { id: 't10', title: 'Seleção de imagens drone', format_type: 'Select', task_date: '2026-06-22', creator_id: 'jp', client_id: 'c1', status: 'no_servidor', description: null, created_by: 'u2', created_at: now, updated_at: now },
  { id: 't11', title: 'Banco de imagens cidade', format_type: 'Banco', task_date: '2026-06-22', creator_id: 'ac', client_id: 'c4', status: 'em_aprovacao', description: null, created_by: 'u2', created_at: now, updated_at: now },
  { id: 't12', title: 'Story enquete saúde', format_type: 'Story', task_date: '2026-06-16', creator_id: 'ml', client_id: 'c5', status: 'aprovado', description: null, created_by: 'u2', created_at: now, updated_at: now },
  { id: 't13', title: 'Reels promo (revisão cliente)', format_type: 'Reels', task_date: '2026-06-15', creator_id: 'jp', client_id: 'c3', status: 'reprovado', description: null, created_by: 'u2', created_at: now, updated_at: now },
  { id: 't14', title: 'Captação ensaio fotográfico', format_type: 'Captação', task_date: '2026-06-23', creator_id: 'ml', client_id: 'c2', status: 'falta_captacao', description: null, created_by: 'u2', created_at: now, updated_at: now },
  { id: 't15', title: 'Aftermovie feira (cancelado)', format_type: 'Aftermovie', task_date: '2026-06-14', creator_id: 'cr', client_id: 'c3', status: 'cancelado', description: null, created_by: 'u2', created_at: now, updated_at: now },
];

/** collaborator_services */
export const services: ServiceRow[] = [
  { id: 's1', service_name: 'Captação aérea — orla', service_type: 'drone', collaborator_id: 'bt', client_id: 'c5', service_date: '2026-06-19', status: 'agendado', notes: null, created_by: 'u2', created_at: now },
  { id: 's2', service_name: 'Ensaio fotográfico produtos', service_type: 'foto', collaborator_id: 'rs', client_id: 'c2', service_date: '2026-06-20', status: 'em_andamento', notes: null, created_by: 'u2', created_at: now },
  { id: 's3', service_name: 'Edição final aftermovie', service_type: 'edicao', collaborator_id: 'cr', client_id: 'c4', service_date: '2026-06-21', status: 'concluido', notes: null, created_by: 'u2', created_at: now },
];

/** scale_months */
export const scaleMonths: ScaleMonth[] = [
  { id: 'sm1', month: 6, year: 2026, created_by: 'u2', created_at: now },
];

/** scale_entries (1 creator por dia útil) */
export const scaleEntries: ScaleEntry[] = ([
  ['2026-06-01', 'ml'], ['2026-06-02', 'jp'], ['2026-06-03', 'ac'], ['2026-06-04', 'cr'], ['2026-06-05', 'ml'],
  ['2026-06-08', 'jp'], ['2026-06-09', 'ac'], ['2026-06-10', 'ml'], ['2026-06-11', 'jp'], ['2026-06-12', 'ac'],
  ['2026-06-15', 'cr'], ['2026-06-16', 'ml'], ['2026-06-17', 'jp'], ['2026-06-18', 'ac'], ['2026-06-19', 'cr'],
  ['2026-06-22', 'ml'], ['2026-06-23', 'jp'], ['2026-06-24', null], ['2026-06-25', 'ac'], ['2026-06-26', 'cr'],
  ['2026-06-29', 'ml'], ['2026-06-30', 'jp'],
] as [string, string | null][]).map(([work_date, creator_id], i) => ({
  id: `se${i + 1}`, scale_month_id: 'sm1', creator_id, work_date, is_holiday: false, created_at: now,
}));

export const holidays: Holiday[] = [
  { id: 'h1', holiday_date: '2026-06-11', description: 'Corpus Christi' },
];

export const absences: Absence[] = [
  { id: 'a1', creator_id: 'ml', start_date: '2026-06-24', end_date: '2026-06-26', reason: 'Consulta médica', status: 'pending', approved_by: null, approved_at: null, created_at: now },
  { id: 'a2', creator_id: 'jp', start_date: '2026-07-01', end_date: '2026-07-05', reason: 'Férias', status: 'pending', approved_by: null, approved_at: null, created_at: now },
  { id: 'a3', creator_id: 'ac', start_date: '2026-06-20', end_date: '2026-06-20', reason: 'Compromisso pessoal', status: 'pending', approved_by: null, approved_at: null, created_at: now },
  { id: 'a4', creator_id: 'cr', start_date: '2026-06-10', end_date: '2026-06-12', reason: 'Atestado médico', status: 'approved', approved_by: 'u2', approved_at: now, created_at: now },
  { id: 'a5', creator_id: 'da', start_date: '2026-06-05', end_date: '2026-06-05', reason: 'Troca de plantão', status: 'rejected', approved_by: 'u2', approved_at: now, created_at: now },
];

export const shifts: Shift[] = [
  { id: 'sh1', shift_date: '2026-06-21', creator_id: 'ml', notes: 'Turno manhã (08h–14h)', status: 'confirmed', created_by: 'u2', created_at: now },
  { id: 'sh2', shift_date: '2026-06-22', creator_id: 'jp', notes: 'Turno manhã (08h–14h)', status: 'confirmed', created_by: 'u2', created_at: now },
  { id: 'sh3', shift_date: '2026-06-28', creator_id: 'ac', notes: 'Turno tarde (14h–20h)', status: 'pending', created_by: 'u2', created_at: now },
  { id: 'sh4', shift_date: '2026-06-29', creator_id: null, notes: 'A designar', status: 'pending', created_by: 'u2', created_at: now },
  { id: 'sh5', shift_date: '2026-06-14', creator_id: 'cr', notes: 'Turno manhã (08h–14h)', status: 'completed', created_by: 'u2', created_at: now },
  { id: 'sh6', shift_date: '2026-06-15', creator_id: 'ml', notes: 'Cancelado pelo cliente', status: 'cancelled', created_by: 'u2', created_at: now },
];

/** Conversa derivada (não é tabela) — para a lista do chat. */
export const conversations: Conversation[] = [
  { user_id: 'u3', last_message: 'Subi o reels na pasta do servidor ✅', last_at: '2026-06-18T09:42:00Z', unread: 2 },
];

export const messages: Message[] = [
  { id: 'm1', sender_id: 'u3', receiver_id: 'u2', message: 'Oi Fernanda! Comecei a edição do reels institucional.', is_read: true, created_at: '2026-06-18T09:20:00Z' },
  { id: 'm2', sender_id: 'u2', receiver_id: 'u3', message: 'Perfeito, Mariana. Lembra de incluir a vinheta nova.', is_read: true, created_at: '2026-06-18T09:24:00Z' },
  { id: 'm3', sender_id: 'u3', receiver_id: 'u2', message: 'Subi o reels na pasta do servidor ✅', is_read: false, created_at: '2026-06-18T09:42:00Z' },
];

export const notifications: Notification[] = [
  { id: 'n1', user_id: 'u2', type: 'nova_tarefa', title: 'Nova tarefa atribuída', description: 'Reels institucional Q2 — Clínica XYZ', is_read: false, created_at: '2026-06-18T09:00:00Z' },
  { id: 'n2', user_id: 'u2', type: 'ausencia_aprovada', title: 'Ausência aprovada', description: 'Camila Reis · 10–12 jun', is_read: false, created_at: '2026-06-17T16:00:00Z' },
  { id: 'n3', user_id: 'u2', type: 'novo_plantao', title: 'Novo plantão criado', description: 'Sáb 28 · Aline Costa', is_read: true, created_at: '2026-06-16T11:00:00Z' },
];
