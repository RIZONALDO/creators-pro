/**
 * Camada de API tipada — ÚNICO ponto que o app usa para ler/gravar dados.
 *
 * Cada função tem DUAS implementações (mock em memória / HTTP REST), escolhidas por
 * VITE_USE_MOCK. A assinatura não muda ao trocar — nenhuma tela precisa mudar.
 * Contrato REST documentado no README.
 */
import { http, setAuthToken, setRefreshToken, getRefreshToken } from './client';
import * as db from './mock';
import type {
  AuthSession, User, NewUser, Creator, NewCreator,
  Collaborator, NewCollaborator, Client, NewClient, CreatorTask, NewTask, TaskStatus,
  ServiceRow, NewService, ServiceStatus, ScaleEntry, Holiday, Absence, NewAbsence, AbsenceStatus,
  Shift, NewShift, Conversation, Message, MessageContact, Notification, StatusHistoryEntry, HistoryEntity,
  ReportFilterParams, ProductionMonthlyRow, ProductionByClientRow, ProductionByCreatorRow,
  ShiftsCompletedReport, AbsencesReportSummary, ApprovedDeliveriesReport,
  TaskReportRow, ServiceReportRow, AbsenceReportRow,
  Attachment, AttachmentEntity, CompanySettings, Profession,
} from '@/types';

const USE_MOCK = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false';
const delay = (ms = 220): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`;
const stamp = () => new Date().toISOString();

/* ============================ AUTH ============================ */
export const auth = {
  async login(email: string, _password: string): Promise<AuthSession> {
    if (USE_MOCK) {
      await delay();
      const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? db.users[1];
      const token = `mock-${user.id}`;
      const refreshToken = `mock-refresh-${user.id}`;
      setAuthToken(token);
      setRefreshToken(refreshToken);
      return { token, refresh_token: refreshToken, user };
    }
    const session = await http.post<AuthSession>('/auth/login', { email, password: _password });
    setAuthToken(session.token);
    setRefreshToken(session.refresh_token);
    return session;
  },
  /** id_token = credential do Google Identity Services (Login.tsx). Nunca cria conta nova — só
   * autentica/completa uma já criada por admin/gestor (ver backend auth.service.ts#loginWithGoogle). */
  async loginWithGoogle(idToken: string): Promise<AuthSession> {
    if (USE_MOCK) return Promise.reject(new Error('Login com Google não disponível em modo mock.'));
    const session = await http.post<AuthSession>('/auth/google', { id_token: idToken });
    setAuthToken(session.token);
    setRefreshToken(session.refresh_token);
    return session;
  },
  /** Ativa uma conta 'pending' (criada só com e-mail, em Cadastros) — única forma de fazer isso,
   * nunca pelo botão de login comum (ver backend auth.service.ts#claimInviteWithGoogle pro porquê). */
  async claimInvite(token: string, idToken: string): Promise<AuthSession> {
    if (USE_MOCK) return Promise.reject(new Error('Convite não disponível em modo mock.'));
    const session = await http.post<AuthSession>('/auth/google/claim', { token, id_token: idToken });
    setAuthToken(session.token);
    setRefreshToken(session.refresh_token);
    return session;
  },
  logout() {
    const refreshToken = getRefreshToken();
    setAuthToken(null);
    setRefreshToken(null);
    if (USE_MOCK || !refreshToken) return Promise.resolve();
    // revoga o refresh_token no servidor — sem isso ele continuaria válido por até 30 dias.
    return http.post<void>('/auth/logout', { refresh_token: refreshToken });
  },
  /** Sempre resolve (backend nunca revela se o e-mail existe — ver auth.service.ts#requestPasswordReset). */
  forgotPassword(email: string): Promise<void> {
    if (USE_MOCK) return Promise.reject(new Error('Reset de senha não disponível em modo mock.'));
    return http.post<void>('/auth/forgot-password', { email });
  },
  /** Token vem do link do e-mail — já devolve sessão (login automático, ver
   * auth.service.ts#resetPassword). */
  async resetPassword(token: string, password: string): Promise<AuthSession> {
    if (USE_MOCK) return Promise.reject(new Error('Reset de senha não disponível em modo mock.'));
    const session = await http.post<AuthSession>('/auth/reset-password', { token, password });
    setAuthToken(session.token);
    setRefreshToken(session.refresh_token);
    return session;
  },
  me(): Promise<User> {
    if (USE_MOCK) return delay(80).then(() => db.users[1]);
    return http.get<{ user: User }>('/auth/me').then((r) => r.user);
  },
};

/* ============================ USERS (admin) ============================ */
export const usersApi = {
  list: (): Promise<User[]> => (USE_MOCK ? delay().then(() => [...db.users]) : http.getList('/users')),
  create: (data: NewUser): Promise<User> => {
    if (USE_MOCK) {
      const u: User = { id: uid('u'), name: data.name, email: data.email, phone: data.phone, role: data.role, status: data.status, created_at: stamp(), updated_at: stamp(), avatar_url: null };
      db.users.push(u);
      return delay().then(() => u);
    }
    return http.post('/users', data);
  },
  update: (id: string, data: Partial<User> & { password?: string }): Promise<User> => {
    if (USE_MOCK) {
      const u = db.users.find((x) => x.id === id)!;
      Object.assign(u, data, { updated_at: stamp() });
      return delay().then(() => u);
    }
    return http.put(`/users/${id}`, data);
  },
  delete: (id: string): Promise<void> => {
    if (USE_MOCK) {
      const idx = db.users.findIndex((x) => x.id === id);
      if (idx >= 0) db.users.splice(idx, 1);
      return delay().then(() => undefined);
    }
    return http.del(`/users/${id}`);
  },
};

/* ============================ PROFESSIONS ============================ */
export const professionsApi = {
  list: (): Promise<Profession[]> => {
    if (USE_MOCK) return delay(60).then(() => db.professions.map((p) => ({ ...p })));
    return http.getList('/professions');
  },
  create: (name: string): Promise<Profession> => {
    if (USE_MOCK) {
      const p: Profession = { id: uid('prof'), name, created_at: stamp() };
      db.professions.push(p);
      return delay(100).then(() => p);
    }
    return http.post('/professions', { name });
  },
  remove: (id: string): Promise<void> => {
    if (USE_MOCK) {
      const idx = db.professions.findIndex((p) => p.id === id);
      if (idx >= 0) db.professions.splice(idx, 1);
      return delay(80);
    }
    return http.del<void>(`/professions/${id}`);
  },
};

/* ============================ CREATORS ============================ */
export const creatorsApi = {
  list: (): Promise<Creator[]> => (USE_MOCK ? delay().then(() => [...db.creators]) : http.getList('/creators')),
  create: (data: NewCreator): Promise<Creator> => {
    if (USE_MOCK) {
      // backend cria users + creators; aqui simulamos o JOIN de volta. Sem nome/senha: convite
      // "pendente" — nome provisório é o e-mail, status fica pending até o 1º login com Google.
      const userId = uid('u');
      const name = data.name?.trim() || data.email || '';
      const status = data.password ? 'active' : 'pending';
      db.users.push({ id: userId, name, email: data.email ?? '', phone: data.phone, role: 'operacional', status, created_at: stamp(), updated_at: stamp(), avatar_url: null });
      const c: Creator = { id: uid('cre'), user_id: userId, employment_type: data.employment_type, active: data.active, created_at: stamp(), name, email: data.email, phone: data.phone, avatar_url: null, status };
      db.creators.push(c);
      return delay().then(() => c);
    }
    return http.post('/creators', data);
  },
  update: (id: string, data: Partial<Creator> & { password?: string }): Promise<Creator> => {
    if (USE_MOCK) {
      const c = db.creators.find((x) => x.id === id)!;
      Object.assign(c, data);
      return delay().then(() => c);
    }
    return http.put(`/creators/${id}`, data);
  },
  /** Bloqueado pelo backend (409) se o creator tiver tarefa/serviço/escala/ausência/plantão vinculado. */
  remove: (id: string): Promise<void> => {
    if (USE_MOCK) {
      const idx = db.creators.findIndex((x) => x.id === id);
      if (idx >= 0) db.creators.splice(idx, 1);
      return delay();
    }
    return http.del<void>(`/creators/${id}`);
  },
  /** Ordem definida por drag na paleta da Escala — base do round-robin da escala automática. */
  reorder: (creatorIds: string[]): Promise<void> => {
    if (USE_MOCK) {
      db.creators.sort((a, b) => creatorIds.indexOf(a.id) - creatorIds.indexOf(b.id));
      return delay(80);
    }
    return http.put<void>('/creators/reorder', { creator_ids: creatorIds });
  },
  /** Gestor perdeu o link mostrado na criação (só aparece uma vez) — gera um token novo,
   * invalidando o anterior. Só funciona pra conta ainda pending (backend rejeita com 409 senão). */
  regenerateInvite: (id: string): Promise<{ invite_token: string }> => {
    if (USE_MOCK) return Promise.reject(new Error('Convite não disponível em modo mock.'));
    return http.post(`/creators/${id}/invite`);
  },
};

/* ============================ COLLABORATORS ============================ */
export const collaboratorsApi = {
  list: (): Promise<Collaborator[]> => (USE_MOCK ? delay().then(() => [...db.collaborators]) : http.getList('/collaborators')),
  create: (data: NewCollaborator): Promise<Collaborator> => {
    if (USE_MOCK) {
      const c: Collaborator = { id: uid('col'), name: data.name, email: data.email ?? null, phone: data.phone ?? null, profession: data.profession, employment_type: data.employment_type, active: data.active, created_at: stamp() };
      db.collaborators.push(c);
      return delay().then(() => c);
    }
    return http.post('/collaborators', data);
  },
  update: (id: string, data: Partial<Collaborator>): Promise<Collaborator> => {
    if (USE_MOCK) {
      const c = db.collaborators.find((x) => x.id === id)!;
      Object.assign(c, data);
      return delay().then(() => c);
    }
    return http.put(`/collaborators/${id}`, data);
  },
  /** Bloqueado pelo backend (409) se o colaborador tiver serviço vinculado. */
  remove: (id: string): Promise<void> => {
    if (USE_MOCK) {
      const idx = db.collaborators.findIndex((x) => x.id === id);
      if (idx >= 0) db.collaborators.splice(idx, 1);
      return delay();
    }
    return http.del<void>(`/collaborators/${id}`);
  },
};

/* ============================ CLIENTS ============================ */
export const clientsApi = {
  list: (): Promise<Client[]> => (USE_MOCK ? delay().then(() => [...db.clients]) : http.getList('/clients')),
  create: (data: NewClient): Promise<Client> => {
    if (USE_MOCK) {
      const c: Client = { id: uid('cli'), name: data.name, active: data.active, created_at: stamp() };
      db.clients.push(c);
      return delay().then(() => c);
    }
    return http.post('/clients', data);
  },
  update: (id: string, data: Partial<Client>): Promise<Client> => {
    if (USE_MOCK) {
      const c = db.clients.find((x) => x.id === id)!;
      Object.assign(c, data);
      return delay().then(() => c);
    }
    return http.put(`/clients/${id}`, data);
  },
  /** Bloqueado pelo backend (409) se o cliente tiver tarefa/serviço vinculado. */
  remove: (id: string): Promise<void> => {
    if (USE_MOCK) {
      const idx = db.clients.findIndex((x) => x.id === id);
      if (idx >= 0) db.clients.splice(idx, 1);
      return delay();
    }
    return http.del<void>(`/clients/${id}`);
  },
};

/* ============================ TASKS ============================ */
export const tasksApi = {
  list: (): Promise<CreatorTask[]> => (USE_MOCK ? delay().then(() => [...db.tasks]) : http.getList('/tasks')),
  create: (data: NewTask, createdBy: string): Promise<CreatorTask> => {
    if (USE_MOCK) {
      const clientName = data.client_id ? db.clients.find((c) => c.id === data.client_id)?.name ?? null : null;
      const t: CreatorTask = { id: uid('t'), ...data, client_name: clientName, created_by: createdBy, created_at: stamp(), updated_at: stamp() };
      db.tasks.push(t);
      return delay().then(() => t);
    }
    return http.post('/tasks', data);
  },
  update: (id: string, data: Partial<CreatorTask>): Promise<CreatorTask> => {
    if (USE_MOCK) {
      const t = db.tasks.find((x) => x.id === id)!;
      // client_id pode ter mudado — client_name precisa ser recalculado, não fica em NewTask.
      const clientName = 'client_id' in data ? (data.client_id ? db.clients.find((c) => c.id === data.client_id)?.name ?? null : null) : t.client_name;
      Object.assign(t, data, { client_name: clientName, updated_at: stamp() });
      return delay().then(() => t);
    }
    return http.put(`/tasks/${id}`, data);
  },
  /** kanban drag-and-drop — registra também task_status_history no backend */
  setStatus: (id: string, status: TaskStatus): Promise<CreatorTask> => {
    if (USE_MOCK) {
      const t = db.tasks.find((x) => x.id === id)!;
      t.status = status; t.updated_at = stamp();
      return delay(80).then(() => t);
    }
    return http.patch(`/tasks/${id}/status`, { status });
  },
  remove: (id: string): Promise<void> => {
    if (USE_MOCK) {
      const idx = db.tasks.findIndex((x) => x.id === id);
      if (idx >= 0) db.tasks.splice(idx, 1);
      return delay();
    }
    return http.del<void>(`/tasks/${id}`);
  },
};

/* ============================ COLLABORATOR_SERVICES ============================ */
export const servicesApi = {
  list: (): Promise<ServiceRow[]> => (USE_MOCK ? delay().then(() => [...db.services]) : http.getList('/services')),
  create: (data: NewService, createdBy: string): Promise<ServiceRow> => {
    if (USE_MOCK) {
      const s: ServiceRow = { id: uid('s'), ...data, created_by: createdBy, created_at: stamp() };
      db.services.push(s);
      return delay().then(() => s);
    }
    return http.post('/services', data);
  },
  update: (id: string, data: Partial<ServiceRow>): Promise<ServiceRow> => {
    if (USE_MOCK) {
      const s = db.services.find((x) => x.id === id)!;
      Object.assign(s, data);
      return delay().then(() => s);
    }
    return http.put(`/services/${id}`, data);
  },
  /** PUT ignora status de propósito (ver backend) — mudar status sempre passa por aqui, registra status_history. */
  setStatus: (id: string, status: ServiceStatus): Promise<ServiceRow> => {
    if (USE_MOCK) {
      const s = db.services.find((x) => x.id === id)!;
      s.status = status;
      return delay(80).then(() => s);
    }
    return http.patch(`/services/${id}/status`, { status });
  },
  remove: (id: string): Promise<void> => {
    if (USE_MOCK) {
      const idx = db.services.findIndex((x) => x.id === id);
      if (idx >= 0) db.services.splice(idx, 1);
      return delay();
    }
    return http.del<void>(`/services/${id}`);
  },
};

/* ============================ SCALE (scale_months / scale_entries) ============================ */
export const scheduleApi = {
  list: (month?: string): Promise<ScaleEntry[]> =>
    (USE_MOCK ? delay().then(() => [...db.scaleEntries]) : http.getList(`/scale-entries${month ? `?month=${month}` : ''}`)),
  /** Adiciona 1 creator a 1 dia — não substitui quem já estiver escalado (mais de 1 por dia é permitido). */
  assign: (workDate: string, creatorId: string): Promise<ScaleEntry> => {
    if (USE_MOCK) {
      const e: ScaleEntry = { id: uid('se'), scale_month_id: 'sm1', creator_id: creatorId, work_date: workDate, is_holiday: false, created_at: stamp() };
      db.scaleEntries.push(e);
      return delay(80).then(() => e);
    }
    return http.post(`/scale-entries/${workDate}`, { creator_id: creatorId });
  },
  /** Remove 1 creator de 1 dia, sem afetar outros creators atribuídos no mesmo dia. */
  unassign: (workDate: string, creatorId: string): Promise<void> => {
    if (USE_MOCK) {
      const i = db.scaleEntries.findIndex((e) => e.work_date === workDate && e.creator_id === creatorId);
      if (i >= 0) db.scaleEntries.splice(i, 1);
      return delay(80).then(() => undefined);
    }
    return http.del(`/scale-entries/${workDate}/${creatorId}`);
  },
};

/* ============================ HOLIDAYS ============================ */
export const holidaysApi = {
  list: (month?: string): Promise<Holiday[]> =>
    (USE_MOCK ? delay(60).then(() => [...db.holidays]) : http.getList(`/holidays${month ? `?month=${month}` : ''}`)),
};

/* ============================ STATUS_HISTORY (polimórfica — admin/gestor) ============================ */
export const statusHistoryApi = {
  list: (entityType: HistoryEntity, entityId: string): Promise<StatusHistoryEntry[]> => {
    if (USE_MOCK) return delay(80).then(() => db.statusHistory.filter((h) => h.entity_type === entityType && h.entity_id === entityId));
    return http.getList(`/status-history?entity_type=${entityType}&entity_id=${entityId}`);
  },
};

/* ============================ ABSENCES ============================ */
export const absencesApi = {
  list: (): Promise<Absence[]> => (USE_MOCK ? delay().then(() => [...db.absences]) : http.getList('/absences')),
  /** creator solicita (app mobile) */
  request: (data: NewAbsence): Promise<Absence> => {
    if (USE_MOCK) {
      const a: Absence = { id: uid('a'), ...data, creator_id: data.creator_id ?? db.creators[0]?.id ?? '', status: 'pending', approved_by: null, approved_at: null, created_at: stamp() };
      db.absences.push(a);
      return delay().then(() => a);
    }
    return http.post('/absences', data);
  },
  /** coordenador aprova/rejeita */
  review: (id: string, status: Exclude<AbsenceStatus, 'pending'>, approvedBy: string): Promise<Absence> => {
    if (USE_MOCK) {
      const a = db.absences.find((x) => x.id === id)!;
      a.status = status; a.approved_by = approvedBy; a.approved_at = stamp();
      return delay(120).then(() => a);
    }
    return http.patch(`/absences/${id}/review`, { status });
  },
};

/* ============================ SHIFTS (plantões) ============================ */
export const shiftsApi = {
  list: (): Promise<Shift[]> => (USE_MOCK ? delay().then(() => [...db.shifts]) : http.getList('/shifts')),
  create: (data: NewShift, createdBy: string): Promise<Shift> => {
    if (USE_MOCK) {
      const standbyCreatorIds = data.standby_creator_ids ?? [];
      const s: Shift = {
        id: uid('sh'), ...data,
        creator_name: db.creators.find((c) => c.id === data.creator_id)?.name ?? null,
        standby_creator_ids: standbyCreatorIds,
        standby_names: standbyCreatorIds.map((id) => db.creators.find((c) => c.id === id)?.name ?? 'Creator'),
        created_by: createdBy, created_at: stamp(),
      };
      db.shifts.push(s);
      return delay().then(() => s);
    }
    return http.post('/shifts', data);
  },
  update: (id: string, data: Partial<Shift>): Promise<Shift> => {
    if (USE_MOCK) {
      const s = db.shifts.find((x) => x.id === id)!;
      Object.assign(s, data);
      // creator_name/standby_names são derivados — sem isto, mudar o creator/sobreaviso na edição
      // deixaria o nome mostrado na tela desatualizado (o real cuida disso no backend).
      if (data.creator_id !== undefined) s.creator_name = db.creators.find((c) => c.id === data.creator_id)?.name ?? null;
      if (data.standby_creator_ids !== undefined) s.standby_names = data.standby_creator_ids.map((cid) => db.creators.find((c) => c.id === cid)?.name ?? 'Creator');
      return delay().then(() => s);
    }
    return http.put(`/shifts/${id}`, data);
  },
  /** PUT ignora status de propósito (mesma razão de servicesApi.setStatus) — só PATCH .../status grava status_history. */
  setStatus: (id: string, status: Shift['status']): Promise<Shift> => {
    if (USE_MOCK) {
      const s = db.shifts.find((x) => x.id === id)!;
      db.statusHistory.push({ id: uid('st'), entity_type: 'shift', entity_id: id, old_status: s.status, new_status: status, changed_by: 'u2', changed_at: stamp() });
      s.status = status;
      return delay(80).then(() => s);
    }
    return http.patch(`/shifts/${id}/status`, { status });
  },
  remove: (id: string): Promise<void> => {
    if (USE_MOCK) {
      const i = db.shifts.findIndex((x) => x.id === id);
      if (i >= 0) db.shifts.splice(i, 1);
      return delay();
    }
    return http.del<void>(`/shifts/${id}`);
  },
};

/* ============================ MESSAGES ============================ */
export const messagesApi = {
  conversations: (): Promise<Conversation[]> => (USE_MOCK ? delay().then(() => [...db.conversations]) : http.getList('/conversations')),
  /** com quem dá pra começar uma conversa nova (não depende de já ter mensagem trocada). */
  contacts: (): Promise<MessageContact[]> =>
    (USE_MOCK ? delay().then(() => db.creators.map((c) => ({ user_id: c.user_id, name: c.name }))) : http.getList('/messages/contacts')),
  /** mensagens trocadas com um usuário (ambos os sentidos) */
  thread: (otherUserId: string): Promise<Message[]> =>
    (USE_MOCK ? delay().then(() => db.messages.filter((m) => m.sender_id === otherUserId || m.receiver_id === otherUserId)) : http.getList(`/messages?with=${otherUserId}`)),
  send: (senderId: string, receiverId: string, message: string): Promise<Message> => {
    if (USE_MOCK) {
      const m: Message = { id: uid('m'), sender_id: senderId, receiver_id: receiverId, message, is_read: false, created_at: stamp() };
      db.messages.push(m);
      return delay(80).then(() => m);
    }
    return http.post('/messages', { receiver_id: receiverId, message });
  },
};

/* ============================ NOTIFICATIONS ============================ */
export const notificationsApi = {
  list: (): Promise<Notification[]> => (USE_MOCK ? delay(80).then(() => [...db.notifications]) : http.getList('/notifications?pageSize=30')),
  markAllRead: (): Promise<void> => {
    if (USE_MOCK) { db.notifications.forEach((n) => (n.is_read = true)); return delay(60); }
    return http.post<void>('/notifications/read-all');
  },
  deleteRead: (): Promise<void> => {
    if (USE_MOCK) { db.notifications.splice(0, db.notifications.length, ...db.notifications.filter((n) => !n.is_read)); return delay(60); }
    return http.del<void>('/notifications/read');
  },
};

/* ============================ PUSH (Web Push) ============================ */
export const pushApi = {
  /** null = não suportado/configurado no servidor (sem VAPID) — frontend trata como "push indisponível". */
  vapidPublicKey: (): Promise<string | null> => {
    if (USE_MOCK) return Promise.resolve(null);
    return http.get<{ data: { public_key: string | null } }>('/push/vapid-public-key').then((r) => r.data.public_key);
  },
  subscribe: (sub: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<void> =>
    (USE_MOCK ? Promise.resolve() : http.post<void>('/push/subscribe', sub)),
  unsubscribe: (endpoint: string): Promise<void> => (USE_MOCK ? Promise.resolve() : http.post<void>('/push/unsubscribe', { endpoint })),
};

/* ============================ REPORTS ============================
 * Antes, o frontend buscava tudo (tasks/creators/clients) e agregava no client. Agora o backend
 * já devolve agregado — nenhuma tela monta SUM/COUNT na mão. */
function reportQuery(f: ReportFilterParams): string {
  const params = new URLSearchParams({ from: f.from, to: f.to });
  if (f.clientId) params.set('clientId', f.clientId);
  if (f.creatorId) params.set('creatorId', f.creatorId);
  if (f.collaboratorId) params.set('collaboratorId', f.collaboratorId);
  return params.toString();
}

export const reportsApi = {
  productionMonthly: (f: ReportFilterParams): Promise<ProductionMonthlyRow[]> =>
    (USE_MOCK ? Promise.resolve([]) : http.getList(`/reports/production-monthly?${reportQuery(f)}`)),
  productionByClient: (f: ReportFilterParams): Promise<ProductionByClientRow[]> =>
    (USE_MOCK ? Promise.resolve([]) : http.getList(`/reports/production-by-client?${reportQuery(f)}`)),
  productionByCreator: (f: ReportFilterParams): Promise<ProductionByCreatorRow[]> =>
    (USE_MOCK ? Promise.resolve([]) : http.getList(`/reports/production-by-creator?${reportQuery(f)}`)),
  shiftsCompleted: (f: ReportFilterParams): Promise<ShiftsCompletedReport> => {
    if (USE_MOCK) return Promise.resolve({ total: 0, by_creator: [] });
    return http.get<{ data: ShiftsCompletedReport }>(`/reports/shifts-completed?${reportQuery(f)}`).then((r) => r.data);
  },
  absencesSummary: (f: ReportFilterParams): Promise<AbsencesReportSummary> => {
    if (USE_MOCK) return Promise.resolve({ total: 0, by_status: [], by_creator: [] });
    return http.get<{ data: AbsencesReportSummary }>(`/reports/absences?${reportQuery(f)}`).then((r) => r.data);
  },
  approvedDeliveries: (f: ReportFilterParams): Promise<ApprovedDeliveriesReport> => {
    if (USE_MOCK) return Promise.resolve({ total: 0, approved: 0, rate: 0 });
    return http.get<{ data: ApprovedDeliveriesReport }>(`/reports/approved-deliveries?${reportQuery(f)}`).then((r) => r.data);
  },
  // listagem completa (não agregada) — "relatório em planilha", pedido direto (specs/08).
  tasksListing: (f: ReportFilterParams): Promise<TaskReportRow[]> =>
    (USE_MOCK ? Promise.resolve([]) : http.getList(`/reports/tasks?${reportQuery(f)}`)),
  servicesListing: (f: ReportFilterParams): Promise<ServiceReportRow[]> =>
    (USE_MOCK ? Promise.resolve([]) : http.getList(`/reports/services?${reportQuery(f)}`)),
  absencesListing: (f: ReportFilterParams): Promise<AbsenceReportRow[]> =>
    (USE_MOCK ? Promise.resolve([]) : http.getList(`/reports/absences-list?${reportQuery(f)}`)),
  exportFile: (type: 'monthly' | 'client' | 'creator' | 'tasks' | 'services' | 'absences' | 'all', format: 'pdf' | 'excel', f: ReportFilterParams): Promise<Blob> => {
    if (USE_MOCK) return Promise.reject(new Error('Exportação não disponível em modo mock.'));
    return http.getBlob(`/reports/export?type=${type}&format=${format}&${reportQuery(f)}`);
  },
};

/* ============================ ATTACHMENTS ============================
 * Storage é disco local no backend (decisão explícita: sem S3/terceiros) — aqui só upload
 * multipart, listagem por entidade, download autenticado (blob) e exclusão. */
export const attachmentsApi = {
  list: (entityType: AttachmentEntity, entityId: string): Promise<Attachment[]> =>
    (USE_MOCK ? Promise.resolve([]) : http.getList(`/attachments?entity_type=${entityType}&entity_id=${entityId}`)),
  upload: (entityType: AttachmentEntity, entityId: string, file: File, onProgress?: (pct: number) => void): Promise<Attachment> => {
    if (USE_MOCK) return Promise.reject(new Error('Upload não disponível em modo mock.'));
    const form = new FormData();
    form.append('entity_type', entityType);
    form.append('entity_id', entityId);
    form.append('file', file);
    return http.uploadWithProgress<{ data: Attachment }>('/attachments', form, onProgress).then((r) => r.data);
  },
  downloadBlob: (id: string): Promise<Blob> => {
    if (USE_MOCK) return Promise.reject(new Error('Download não disponível em modo mock.'));
    return http.getBlob(`/attachments/${id}/file`);
  },
  remove: (id: string): Promise<void> => (USE_MOCK ? Promise.resolve() : http.del<void>(`/attachments/${id}`)),
};

const MOCK_COMPANY_SETTINGS: CompanySettings = { tenant_id: 'mock', display_name: null, logo_url: null, app_name: null, app_subtitle: null, timezone: 'America/Sao_Paulo', locale: 'pt-BR', updated_at: null };

/* ============================ COMPANY SETTINGS ============================
 * 1 linha por tenant — GET liberado a qualquer autenticado, PUT só admin (backend confere de novo, isto é só UX). */
export const companyApi = {
  get: (): Promise<CompanySettings> => (USE_MOCK ? Promise.resolve(MOCK_COMPANY_SETTINGS) : http.get<{ data: CompanySettings }>('/company/settings').then((r) => r.data)),
  update: (input: Partial<Pick<CompanySettings, 'display_name' | 'logo_url' | 'app_name' | 'app_subtitle' | 'timezone' | 'locale'>>): Promise<CompanySettings> => {
    if (USE_MOCK) return Promise.resolve({ ...MOCK_COMPANY_SETTINGS, ...input });
    return http.put<{ data: CompanySettings }>('/company/settings', input).then((r) => r.data);
  },
};

/* ============================ BILLING (Fase 9.1 — self-service signup + Stripe) ============================ */
export interface PublicPlan {
  id: string;
  name: string;
  billing_type: 'monthly' | 'yearly' | 'one_time' | 'manual';
  price_cents: number;
  currency: string;
  max_gestores: number | null;
  max_creators: number | null;
  stripe_price_id: string | null;
}

export interface SignupInput {
  company_name: string;
  admin_name: string;
  admin_email: string;
  admin_password: string;
  plan_id?: string;
}

export interface BillingStatus {
  status: 'active' | 'suspended' | 'cancelled' | 'trial';
  has_subscription: boolean;
  trial_ends_at: string | null;
}

export const billingApi = {
  publicPlans: (): Promise<PublicPlan[]> => {
    return http.get<{ data: PublicPlan[] }>('/plans/public').then((r) => r.data);
  },
  signup: (input: SignupInput): Promise<{ checkout_url: string }> => {
    if (USE_MOCK) return Promise.reject(new Error('Cadastro não disponível em modo mock.'));
    return http.post<{ data: { checkout_url: string } }>('/signup', input).then((r) => r.data);
  },
  /** Sem cartão, sem Stripe — cria a empresa direto e já devolve sessão (login automático). */
  startTrial: (input: SignupInput): Promise<AuthSession> => {
    if (USE_MOCK) return Promise.reject(new Error('Teste grátis não disponível em modo mock.'));
    return http.post<AuthSession>('/signup/trial', input).then((session) => {
      setAuthToken(session.token);
      setRefreshToken(session.refresh_token);
      return session;
    });
  },
  /** Sem sessão de propósito (trial vencido = login bloqueado) — confirma e-mail+senha de novo pra
   * provar identidade e abrir o checkout, mantendo a MESMA empresa (ver billing.service.ts#upgradeTrial). */
  upgradeTrial: (email: string, password: string): Promise<{ checkout_url: string }> => {
    if (USE_MOCK) return Promise.reject(new Error('Assinatura não disponível em modo mock.'));
    return http.post<{ data: { checkout_url: string } }>('/billing/upgrade-trial', { email, password }).then((r) => r.data);
  },
  /** Admin já logado, gerenciando a própria cobrança (seção Cobrança) — Stripe Customer Portal. */
  portal: (): Promise<{ portal_url: string }> => {
    if (USE_MOCK) return Promise.reject(new Error('Cobrança não disponível em modo mock.'));
    return http.post<{ data: { portal_url: string } }>('/billing/portal').then((r) => r.data);
  },
  status: (): Promise<BillingStatus> => {
    if (USE_MOCK) return Promise.resolve({ status: 'active', has_subscription: false, trial_ends_at: null });
    return http.get<{ data: BillingStatus }>('/billing/status').then((r) => r.data);
  },
  /** Diferente de status() — vai até a Stripe de verdade, só usado na tela Conta (contagem
   * regressiva de renovação), nunca no sidebar. */
  renewal: (): Promise<{ renews_at: string | null }> => {
    if (USE_MOCK) return Promise.resolve({ renews_at: null });
    return http.get<{ data: { renews_at: string | null } }>('/billing/renewal').then((r) => r.data);
  },
  invoices: (): Promise<{ invoices: Invoice[] }> => {
    if (USE_MOCK) return Promise.resolve({ invoices: [] });
    return http.get<{ data: { invoices: Invoice[] } }>('/billing/invoices').then((r) => r.data);
  },
};

export interface Invoice {
  id: string;
  number: string | null;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void' | null;
  amount_paid: number;
  currency: string;
  created_at: string;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
}

/* ============================ ACCOUNT (exclusão permanente, só em trial) ============================ */
export const accountApi = {
  /** Permanente — apaga a empresa inteira (ver backend account.service.ts). Backend recusa se a
   * empresa não estiver em trial (ACCOUNT_DELETE_NOT_ALLOWED). */
  delete: (): Promise<void> => {
    if (USE_MOCK) return Promise.reject(new Error('Exclusão de conta não disponível em modo mock.'));
    return http.del<void>('/account');
  },
};

export interface OnboardingStatus {
  has_gestor: boolean;
  has_creator: boolean;
  has_task: boolean;
  has_scale_entry: boolean;
}

const onboardingApi = {
  status: (): Promise<OnboardingStatus> =>
    http.get<{ data: OnboardingStatus }>('/onboarding/status').then((r) => r.data),
};

export const api = {
  auth, users: usersApi, professions: professionsApi, creators: creatorsApi,
  collaborators: collaboratorsApi, clients: clientsApi, tasks: tasksApi, services: servicesApi,
  schedule: scheduleApi, holidays: holidaysApi, absences: absencesApi, shifts: shiftsApi,
  messages: messagesApi, notifications: notificationsApi, statusHistory: statusHistoryApi, push: pushApi,
  reports: reportsApi, attachments: attachmentsApi, company: companyApi, billing: billingApi,
  account: accountApi, onboarding: onboardingApi,
};
