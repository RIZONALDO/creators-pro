# 02 — Modelo de Dados (PostgreSQL + Drizzle)

> Schema completo, multi-tenant, com os gaps identificados na modelagem original já corrigidos.
> Notação Drizzle-like simplificada — não é código pronto para rodar, é a especificação de cada tabela.
> Convenção: `id` é sempre `uuid` (`gen_random_uuid()` via extensão `pgcrypto`), timestamps em `timestamptz`.

## O que muda em relação ao schema original enviado

| # | Mudança | Motivo |
|---|---|---|
| 1 | + tabela `companies` | Base do multi-tenancy |
| 2 | `tenant_id` em toda tabela de negócio | Isolamento entre empresas — ver [01-arquitetura-geral.md](./01-arquitetura-geral.md) |
| 3 | `role`, `status`, `format_type`, `employment_type`, `service_type`(parcial), `notification.type`, `attachment.entity_type` → `pgEnum` em vez de `VARCHAR` livre | Integridade no nível do banco, não só na aplicação |
| 4 | `task_status_history` → generalizada para `status_history` (polimórfica) | Cobre `absences`, `shifts`, `collaborator_services` também — pedido explícito da proposta original ("Histórico" em Plantões) |
| 5 | `holidays` ganha `tenant_id` **nullable** (NULL = feriado nacional/global, preenchido = feriado específico da empresa) | Hoje a tabela existe mas não é usada por nenhum endpoint; isso a torna funcional |
| 6 | `scale_entries` ganha `UNIQUE(tenant_id, work_date)` | Regra observada no mock e na tela: 1 creator por dia útil |
| 7 | + tabela `company_settings` | Cobre "Configurações gerais" (permissão do Admin na proposta), inexistente hoje |
| 8 | + tabela `refresh_tokens` | Permite logout/revogação real, hoje o JWT é stateless e logout não invalida nada |
| 9 | + coluna `avatar_url` em `users` | UI já tem botão "Trocar foto" sem campo correspondente |
| 10 | `NOT NULL` adicionado onde `types.ts` já assume valor obrigatório | Hoje o SQL original permite NULL em colunas que o frontend nunca trata como nulas (`status`, `created_by`) |
| 11 | `ON DELETE` explícito em toda FK | Original não declarava, comportamento ficava ambíguo |
| 12 | Índices compostos com `tenant_id` líder | Toda query de listagem filtra por tenant primeiro |

`professions` continua **não sendo uma tabela** (decisão já documentada em `frontend/README.md`) — fica como `VARCHAR(100)` em `collaborators.profession`, escopado por `tenant_id` naturalmente porque `collaborators` tem `tenant_id`.

---

## Enums

```ts
export const userRoleEnum = pgEnum('user_role', ['admin', 'gestor', 'operacional']);
export const userStatusEnum = pgEnum('user_status', ['active', 'inactive']);
export const employmentTypeEnum = pgEnum('employment_type', ['fixed', 'freelancer']);

export const taskFormatEnum = pgEnum('task_format', [
  'Story', 'Reels', 'Story/Reels', 'Select', 'Edição',
  'Sonora', 'Banco', 'Aftermovie', 'Captação', 'Roteiro',
]);

export const taskStatusEnum = pgEnum('task_status', [
  'na_fila', 'em_edicao', 'no_servidor', 'em_aprovacao', 'em_alteracao',
  'falta_captacao', 'aprovado', 'reprovado', 'cancelado',
]);

export const serviceStatusEnum = pgEnum('service_status', ['agendado', 'em_andamento', 'concluido', 'cancelado']);
export const absenceStatusEnum = pgEnum('absence_status', ['pending', 'approved', 'rejected']);
export const shiftStatusEnum = pgEnum('shift_status', ['pending', 'confirmed', 'completed', 'cancelled']);

export const notificationTypeEnum = pgEnum('notification_type', [
  'nova_tarefa', 'mudanca_status', 'ausencia_aprovada',
  'ausencia_rejeitada', 'novo_plantao', 'alteracao_escala',
]);

export const attachmentEntityEnum = pgEnum('attachment_entity', ['task', 'service', 'absence', 'message', 'shift']);
export const historyEntityEnum = pgEnum('history_entity', ['task', 'absence', 'shift', 'service']);
export const companyStatusEnum = pgEnum('company_status', ['active', 'suspended', 'cancelled']);
```

---

## `companies` (novo — raiz do tenant)

```ts
export const companies = pgTable('companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),   // reservado p/ uso futuro (subdomínio/branding)
  status: companyStatusEnum('status').notNull().default('active'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});
```

`companies` nunca é hard-deletada via FK cascade — desativação é via `status = 'cancelled'`, nunca `DELETE`.

---

## `users`

```ts
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),   // único GLOBAL, não por tenant — ver 01
  phone: varchar('phone', { length: 50 }),
  passwordHash: text('password_hash').notNull(),
  avatarUrl: text('avatar_url'),                                  // NOVO
  role: userRoleEnum('role').notNull(),
  status: userStatusEnum('status').notNull().default('active'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index('users_tenant_idx').on(t.tenantId),
}));
```

`password_hash` nunca é serializado nas respostas da API (já é a convenção do frontend hoje).

---

## `creators`

```ts
export const creators = pgTable('creators', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  employmentType: employmentTypeEnum('employment_type'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index('creators_tenant_idx').on(t.tenantId),
}));
```

`ON DELETE CASCADE` em `user_id`: se o `user` for removido, o perfil de creator some com ele (é um vínculo 1:1 de extensão, não tem sentido sobreviver órfão).

---

## `collaborators`

```ts
export const collaborators = pgTable('collaborators', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  profession: varchar('profession', { length: 100 }),
  employmentType: employmentTypeEnum('employment_type'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index('collaborators_tenant_idx').on(t.tenantId),
}));
```

---

## `clients`

```ts
export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
  name: varchar('name', { length: 255 }).notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index('clients_tenant_idx').on(t.tenantId),
}));
```

---

## `creator_tasks`

```ts
export const creatorTasks = pgTable('creator_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
  title: varchar('title', { length: 255 }).notNull(),
  formatType: taskFormatEnum('format_type'),
  taskDate: date('task_date'),
  creatorId: uuid('creator_id').references(() => creators.id, { onDelete: 'set null' }),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'restrict' }),
  status: taskStatusEnum('status').notNull().default('na_fila'),       // NOT NULL — fix #10
  description: text('description'),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantStatusIdx: index('tasks_tenant_status_idx').on(t.tenantId, t.status),
  tenantDateIdx: index('tasks_tenant_date_idx').on(t.tenantId, t.taskDate),
  tenantCreatorIdx: index('tasks_tenant_creator_idx').on(t.tenantId, t.creatorId),
}));
```

`client_id` é `ON DELETE RESTRICT`: cliente com tarefas não pode ser hard-deletado, só desativado (`clients.active = false`) — já existe o campo pra isso.

---

## `collaborator_services`

```ts
export const collaboratorServices = pgTable('collaborator_services', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
  serviceName: varchar('service_name', { length: 255 }).notNull(),
  serviceDate: date('service_date'),
  serviceType: varchar('service_type', { length: 100 }),     // drone | foto | edicao | sonora | outros (livre, como no mock)
  collaboratorId: uuid('collaborator_id').references(() => collaborators.id, { onDelete: 'set null' }),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'restrict' }),
  status: serviceStatusEnum('status').notNull().default('agendado'),
  notes: text('notes'),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
}, (t) => ({
  tenantStatusIdx: index('services_tenant_status_idx').on(t.tenantId, t.status),
}));
```

---

## `scale_months`

```ts
export const scaleMonths = pgTable('scale_months', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
  month: integer('month').notNull(),     // 1-12
  year: integer('year').notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
}, (t) => ({
  uniqueMonth: unique('scale_months_tenant_month_year').on(t.tenantId, t.month, t.year),
}));
```

`UNIQUE(tenant_id, month, year)` — novo. Sem isso, "Duplicar mês" poderia criar dois `scale_months` para o mesmo período.

---

## `scale_entries`

```ts
export const scaleEntries = pgTable('scale_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
  scaleMonthId: uuid('scale_month_id').notNull().references(() => scaleMonths.id, { onDelete: 'cascade' }),
  creatorId: uuid('creator_id').references(() => creators.id, { onDelete: 'set null' }),
  workDate: date('work_date').notNull(),
  isHoliday: boolean('is_holiday').notNull().default(false),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
}, (t) => ({
  uniqueWorkDate: unique('scale_entries_tenant_work_date').on(t.tenantId, t.workDate),   // fix #6
}));
```

`is_holiday` passa a ser **calculado pelo backend** ao gerar/consultar a escala (cruzando com `holidays`), não mais um campo digitado manualmente — ver regra em [06-regras-de-negocio.md](./06-regras-de-negocio.md).

---

## `holidays`

```ts
export const holidays = pgTable('holidays', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => companies.id, { onDelete: 'cascade' }),  // NULL = feriado nacional/global
  holidayDate: date('holiday_date').notNull(),
  description: varchar('description', { length: 255 }),
}, (t) => ({
  uniqueDate: unique('holidays_tenant_date').on(t.tenantId, t.holidayDate),
}));
```

Fix #5: agora existe a distinção feriado global (ex.: Corpus Christi, feriados nacionais — seed único, compartilhado por todas as empresas) vs feriado específico de uma empresa (ex.: aniversário da agência, feriado municipal). A query de "feriados do mês" sempre busca `tenant_id = :tenantId OR tenant_id IS NULL`.

---

## `absences`

```ts
export const absences = pgTable('absences', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
  creatorId: uuid('creator_id').notNull().references(() => creators.id, { onDelete: 'cascade' }),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  reason: text('reason'),
  status: absenceStatusEnum('status').notNull().default('pending'),
  approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
  approvedAt: timestamptz('approved_at'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
}, (t) => ({
  tenantStatusIdx: index('absences_tenant_status_idx').on(t.tenantId, t.status),
  tenantCreatorIdx: index('absences_tenant_creator_idx').on(t.tenantId, t.creatorId),
}));
```

---

## `shifts`

```ts
export const shifts = pgTable('shifts', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
  shiftDate: date('shift_date').notNull(),
  creatorId: uuid('creator_id').references(() => creators.id, { onDelete: 'set null' }),
  notes: text('notes'),
  status: shiftStatusEnum('status').notNull().default('pending'),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
}, (t) => ({
  tenantDateIdx: index('shifts_tenant_date_idx').on(t.tenantId, t.shiftDate),
}));
```

---

## `status_history` (substitui `task_status_history` — fix #4)

```ts
export const statusHistory = pgTable('status_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
  entityType: historyEntityEnum('entity_type').notNull(),   // task | absence | shift | service
  entityId: uuid('entity_id').notNull(),
  oldStatus: varchar('old_status', { length: 50 }),
  newStatus: varchar('new_status', { length: 50 }).notNull(),
  changedBy: uuid('changed_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  changedAt: timestamptz('changed_at').notNull().defaultNow(),
}, (t) => ({
  entityIdx: index('status_history_entity_idx').on(t.tenantId, t.entityType, t.entityId),
}));
```

Por que polimórfica em vez de 4 tabelas (`task_status_history`, `absence_status_history`, ...): mesmo padrão já usado em `attachments` (que é polimórfica via `entity_type`/`entity_id`), evita repetir a mesma estrutura 4 vezes, e qualquer tela de "histórico" (ex.: Plantões, pedido explícito na proposta) usa a mesma query.

Toda mudança de `status` em `creator_tasks`, `absences`, `shifts`, `collaborator_services` grava uma linha aqui — feito na camada de serviço do backend (não trigger de banco, para manter a lógica de quem mudou e por quê testável e logável). Ver [06-regras-de-negocio.md](./06-regras-de-negocio.md).

---

## `messages`

```ts
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
  senderId: uuid('sender_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  receiverId: uuid('receiver_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  message: text('message').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
}, (t) => ({
  conversationIdx: index('messages_tenant_pair_idx').on(t.tenantId, t.senderId, t.receiverId),
}));
```

Validação de aplicação (não dá pra expressar como `CHECK` simples): `sender_id` e `receiver_id` precisam pertencer ao mesmo `tenant_id` da mensagem. Isso é garantido no service layer, não no banco.

---

## `notifications`

```ts
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }),
  description: text('description'),
  type: notificationTypeEnum('type').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
}, (t) => ({
  userUnreadIdx: index('notifications_user_unread_idx').on(t.userId, t.isRead),
}));
```

---

## `attachments`

```ts
export const attachments = pgTable('attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
  fileName: varchar('file_name', { length: 255 }),
  fileUrl: text('file_url').notNull(),
  entityType: attachmentEntityEnum('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  uploadedBy: uuid('uploaded_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
}, (t) => ({
  entityIdx: index('attachments_entity_idx').on(t.tenantId, t.entityType, t.entityId),
}));
```

Avatar de usuário **não** passa por aqui — usa `users.avatar_url` direto (mais simples que estender o enum com `'user'` para um caso de uso 1:1).

---

## `company_settings` (novo — fix #7)

```ts
export const companySettings = pgTable('company_settings', {
  tenantId: uuid('tenant_id').primaryKey().references(() => companies.id, { onDelete: 'cascade' }),
  displayName: varchar('display_name', { length: 255 }),
  logoUrl: text('logo_url'),
  timezone: varchar('timezone', { length: 50 }).notNull().default('America/Sao_Paulo'),
  locale: varchar('locale', { length: 10 }).notNull().default('pt-BR'),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});
```

Uma linha por tenant (`tenant_id` é PK e FK ao mesmo tempo). Cobre a permissão "Configurações gerais" do Admin que estava sem nenhuma tabela correspondente.

---

## `refresh_tokens` (novo — fix #8)

```ts
export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),     // nunca guardar o token em texto puro
  userAgent: varchar('user_agent', { length: 255 }),
  expiresAt: timestamptz('expires_at').notNull(),
  revokedAt: timestamptz('revoked_at'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
}, (t) => ({
  userIdx: index('refresh_tokens_user_idx').on(t.userId),
}));
```

Permite logout real (`revokedAt = now()`) e revogação em massa (ex.: trocar senha invalida todos os refresh tokens do usuário).

---

## Diagrama de relacionamento (atualizado)

```text
companies (raiz do tenant)
│
├── users
│   ├── creators
│   │   ├── creator_tasks (creator_id)
│   │   ├── scale_entries (creator_id)
│   │   ├── absences (creator_id)
│   │   └── shifts (creator_id)
│   │
│   ├── collaborators
│   │   └── collaborator_services (collaborator_id)
│   │
│   ├── messages (sender_id / receiver_id)
│   ├── notifications (user_id)
│   ├── attachments (uploaded_by)
│   └── refresh_tokens (user_id)
│
├── clients
│   ├── creator_tasks (client_id)
│   └── collaborator_services (client_id)
│
├── scale_months
│   └── scale_entries
│
├── holidays (tenant_id nullable — NULL = global)
│
├── company_settings (1:1 com companies)
│
status_history (polimórfica: task | absence | shift | service)
attachments (polimórfica: task | service | absence | message | shift)
```

Todas as tabelas de negócio (exceto `holidays` quando global) carregam `tenant_id` mesmo já havendo um caminho indireto até `companies` via `users`/`creators`/etc. — decisão deliberada, ver [01-arquitetura-geral.md](./01-arquitetura-geral.md#decisão-central-multi-tenancy).
