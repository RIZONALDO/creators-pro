/**
 * Camada de API tipada — ÚNICO ponto que o app usa para ler/gravar dados.
 *
 * Cada função tem DUAS implementações (mock em memória / HTTP REST), escolhidas por
 * VITE_USE_MOCK. A assinatura não muda ao trocar — nenhuma tela precisa mudar.
 * Contrato REST documentado no README.
 */
import { http, setAuthToken } from './client';
import * as db from './mock';
import type {
  AuthSession, User, NewUser, Creator, NewCreator,
  Collaborator, NewCollaborator, Client, NewClient, CreatorTask, NewTask, TaskStatus,
  ServiceRow, NewService, ScaleEntry, Absence, NewAbsence, AbsenceStatus,
  Shift, NewShift, Conversation, Message, Notification,
} from '@/types';

const USE_MOCK = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false';
const delay = (ms = 220) => new Promise((r) => setTimeout(r, ms));
const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`;
const stamp = () => new Date().toISOString();

/* ============================ AUTH ============================ */
export const auth = {
  async login(email: string, _password: string): Promise<AuthSession> {
    if (USE_MOCK) {
      await delay();
      const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? db.users[1];
      const token = `mock-${user.id}`;
      setAuthToken(token);
      return { token, user };
    }
    const session = await http.post<AuthSession>('/auth/login', { email, password: _password });
    setAuthToken(session.token);
    return session;
  },
  logout() {
    setAuthToken(null);
    return USE_MOCK ? Promise.resolve() : http.post<void>('/auth/logout');
  },
  me(): Promise<User> {
    if (USE_MOCK) return delay(80).then(() => db.users[1]);
    return http.get<User>('/auth/me');
  },
};

/* ============================ USERS (admin) ============================ */
export const usersApi = {
  list: (): Promise<User[]> => (USE_MOCK ? delay().then(() => [...db.users]) : http.get('/users')),
  create: (data: NewUser): Promise<User> => {
    if (USE_MOCK) {
      const u: User = { id: uid('u'), name: data.name, email: data.email, phone: data.phone, role: data.role, status: data.status, created_at: stamp(), updated_at: stamp() };
      db.users.push(u);
      return delay().then(() => u);
    }
    return http.post('/users', data);
  },
  update: (id: string, data: Partial<User>): Promise<User> => {
    if (USE_MOCK) {
      const u = db.users.find((x) => x.id === id)!;
      Object.assign(u, data, { updated_at: stamp() });
      return delay().then(() => u);
    }
    return http.put(`/users/${id}`, data);
  },
};

/* ============================ PROFESSIONS (collaborators.profession VARCHAR) ============================
 * Não é tabela — apenas a lista distinta de valores já usados, para o autocomplete do modal. */
export const professionsApi = {
  list: (): Promise<string[]> => {
    if (USE_MOCK) return delay(60).then(() => Array.from(new Set([...db.PROFESSIONS, ...db.collaborators.map((c) => c.profession).filter(Boolean) as string[]])));
    return http.get('/professions');
  },
  create: (name: string): Promise<string> => {
    if (USE_MOCK) { if (!db.PROFESSIONS.includes(name)) db.PROFESSIONS.push(name); return delay(100).then(() => name); }
    return http.post('/professions', { name });
  },
};

/* ============================ CREATORS ============================ */
export const creatorsApi = {
  list: (): Promise<Creator[]> => (USE_MOCK ? delay().then(() => [...db.creators]) : http.get('/creators')),
  create: (data: NewCreator): Promise<Creator> => {
    if (USE_MOCK) {
      // backend cria users + creators; aqui simulamos o JOIN de volta
      const userId = uid('u');
      db.users.push({ id: userId, name: data.name, email: data.email ?? '', phone: data.phone, role: 'operacional', status: 'active', created_at: stamp(), updated_at: stamp() });
      const c: Creator = { id: uid('cre'), user_id: userId, employment_type: data.employment_type, active: data.active, created_at: stamp(), name: data.name, email: data.email, phone: data.phone };
      db.creators.push(c);
      return delay().then(() => c);
    }
    return http.post('/creators', data);
  },
  update: (id: string, data: Partial<Creator>): Promise<Creator> => {
    if (USE_MOCK) {
      const c = db.creators.find((x) => x.id === id)!;
      Object.assign(c, data);
      return delay().then(() => c);
    }
    return http.put(`/creators/${id}`, data);
  },
};

/* ============================ COLLABORATORS ============================ */
export const collaboratorsApi = {
  list: (): Promise<Collaborator[]> => (USE_MOCK ? delay().then(() => [...db.collaborators]) : http.get('/collaborators')),
  create: (data: NewCollaborator): Promise<Collaborator> => {
    if (USE_MOCK) {
      const userId = uid('u');
      db.users.push({ id: userId, name: data.name, email: data.email ?? '', phone: data.phone, role: 'operacional', status: 'active', created_at: stamp(), updated_at: stamp() });
      const c: Collaborator = { id: uid('col'), user_id: userId, profession: data.profession, employment_type: data.employment_type, active: data.active, created_at: stamp(), name: data.name, email: data.email, phone: data.phone };
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
};

/* ============================ CLIENTS ============================ */
export const clientsApi = {
  list: (): Promise<Client[]> => (USE_MOCK ? delay().then(() => [...db.clients]) : http.get('/clients')),
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
};

/* ============================ TASKS ============================ */
export const tasksApi = {
  list: (): Promise<CreatorTask[]> => (USE_MOCK ? delay().then(() => [...db.tasks]) : http.get('/tasks')),
  create: (data: NewTask, createdBy: string): Promise<CreatorTask> => {
    if (USE_MOCK) {
      const t: CreatorTask = { id: uid('t'), ...data, created_by: createdBy, created_at: stamp(), updated_at: stamp() };
      db.tasks.push(t);
      return delay().then(() => t);
    }
    return http.post('/tasks', data);
  },
  update: (id: string, data: Partial<CreatorTask>): Promise<CreatorTask> => {
    if (USE_MOCK) {
      const t = db.tasks.find((x) => x.id === id)!;
      Object.assign(t, data, { updated_at: stamp() });
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
};

/* ============================ COLLABORATOR_SERVICES ============================ */
export const servicesApi = {
  list: (): Promise<ServiceRow[]> => (USE_MOCK ? delay().then(() => [...db.services]) : http.get('/services')),
  create: (data: NewService, createdBy: string): Promise<ServiceRow> => {
    if (USE_MOCK) {
      const s: ServiceRow = { id: uid('s'), ...data, created_by: createdBy, created_at: stamp() };
      db.services.push(s);
      return delay().then(() => s);
    }
    return http.post('/services', data);
  },
};

/* ============================ SCALE (scale_months / scale_entries) ============================ */
export const scheduleApi = {
  list: (month?: string): Promise<ScaleEntry[]> =>
    (USE_MOCK ? delay().then(() => [...db.scaleEntries]) : http.get(`/scale-entries${month ? `?month=${month}` : ''}`)),
  assign: (workDate: string, creatorId: string | null): Promise<ScaleEntry> => {
    if (USE_MOCK) {
      let e = db.scaleEntries.find((x) => x.work_date === workDate);
      if (e) e.creator_id = creatorId;
      else { e = { id: uid('se'), scale_month_id: 'sm1', creator_id: creatorId, work_date: workDate, is_holiday: false, created_at: stamp() }; db.scaleEntries.push(e); }
      return delay(80).then(() => e!);
    }
    return http.put(`/scale-entries/${workDate}`, { creator_id: creatorId });
  },
};

/* ============================ ABSENCES ============================ */
export const absencesApi = {
  list: (): Promise<Absence[]> => (USE_MOCK ? delay().then(() => [...db.absences]) : http.get('/absences')),
  /** creator solicita (app mobile) */
  request: (data: NewAbsence): Promise<Absence> => {
    if (USE_MOCK) {
      const a: Absence = { id: uid('a'), ...data, status: 'pending', approved_by: null, approved_at: null, created_at: stamp() };
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
  list: (): Promise<Shift[]> => (USE_MOCK ? delay().then(() => [...db.shifts]) : http.get('/shifts')),
  create: (data: NewShift, createdBy: string): Promise<Shift> => {
    if (USE_MOCK) {
      const s: Shift = { id: uid('sh'), ...data, created_by: createdBy, created_at: stamp() };
      db.shifts.push(s);
      return delay().then(() => s);
    }
    return http.post('/shifts', data);
  },
};

/* ============================ MESSAGES ============================ */
export const messagesApi = {
  conversations: (): Promise<Conversation[]> => (USE_MOCK ? delay().then(() => [...db.conversations]) : http.get('/conversations')),
  /** mensagens trocadas com um usuário (ambos os sentidos) */
  thread: (otherUserId: string): Promise<Message[]> =>
    (USE_MOCK ? delay().then(() => db.messages.filter((m) => m.sender_id === otherUserId || m.receiver_id === otherUserId)) : http.get(`/messages?with=${otherUserId}`)),
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
  list: (): Promise<Notification[]> => (USE_MOCK ? delay(80).then(() => [...db.notifications]) : http.get('/notifications')),
  markAllRead: (): Promise<void> => {
    if (USE_MOCK) { db.notifications.forEach((n) => (n.is_read = true)); return delay(60); }
    return http.post('/notifications/read-all');
  },
};

export const api = {
  auth, users: usersApi, professions: professionsApi, creators: creatorsApi,
  collaborators: collaboratorsApi, clients: clientsApi, tasks: tasksApi, services: servicesApi,
  schedule: scheduleApi, absences: absencesApi, shifts: shiftsApi, messages: messagesApi,
  notifications: notificationsApi,
};
