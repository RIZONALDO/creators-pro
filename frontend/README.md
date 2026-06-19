# CreatorsPro — Frontend (React + TypeScript + Vite)

Frontend do CreatorsPro exportado do protótipo de alta fidelidade. Já vem **rodável** com uma
camada de dados **mock em memória**, pronto para você plugar o backend **Node/Express + Postgres + Socket.IO**.

---

## 🚀 Rodar localmente

```bash
cd export-react
npm install
npm run dev          # http://localhost:5173
```

Build de produção:

```bash
npm run build        # gera dist/
npm run preview
```

> **Acessos demo** (mock): na tela de login clique em **Coordenador** (`fernanda@studionorte.com`)
> para entrar no app completo, ou **Admin** (`carlos@studionorte.com`) para a área administrativa.
> Qualquer senha serve enquanto `VITE_USE_MOCK=true`.

---

## 🧱 Stack

- **React 18** + **TypeScript** (strict)
- **Vite 5** (dev server + build)
- **react-router-dom 6** (roteamento por perfil)
- **Estilos inline** com **CSS custom properties** para tema (dark/light) — sem framework de CSS.
  Tokens em `src/theme.css`.

---

## 📁 Estrutura

```
src/
├── main.tsx                 # bootstrap (Router + AppProvider)
├── App.tsx                  # rotas; roteia admin vs coordenador vs login
├── theme.css                # tokens de tema (dark/light) + reset + animações
├── types.ts                 # ⭐ modelo de dados — 1:1 com o schema Postgres
├── api/
│   ├── client.ts            # fetch wrapper (baseURL, token, erros)
│   ├── index.ts             # ⭐ camada de API tipada (mock OU http por flag)
│   ├── mock.ts              # dados mock em memória (fiéis ao protótipo)
│   └── socket.ts            # stub Socket.IO p/ chat em tempo real
├── context/
│   ├── AppContext.ts        # contexto (user, tema)
│   └── AppProvider.tsx      # provider (auth + persistência de tema)
├── lib/
│   ├── display.ts           # cores/labels derivados dos enums; helpers de avatar/data
│   └── useAsync.ts          # hook de carregamento assíncrono
├── components/
│   ├── AppLayout.tsx        # shell (sidebar + topbar + <Outlet/>)
│   ├── Sidebar.tsx, Topbar.tsx
│   ├── Modal.tsx            # Modal + campos de formulário
│   └── ui.tsx               # Avatar, Button, Card, StatusPill, Tag, Spinner, EmptyState
└── screens/
    ├── Login.tsx  AdminUsers.tsx
    ├── Dashboard.tsx  Tasks.tsx  Services.tsx  Schedule.tsx
    ├── Absences.tsx  Shifts.tsx  Messages.tsx  Reports.tsx  Cadastros.tsx
```

---

## 🔌 Plugar o backend

Toda leitura/gravação passa por **`src/api/index.ts`**. Cada função tem duas implementações
(mock e HTTP) escolhidas pela env `VITE_USE_MOCK`. **Nenhuma tela muda** ao trocar.

1. Copie `.env.example` para `.env` e ajuste:
   ```
   VITE_USE_MOCK=false
   VITE_API_BASE_URL=http://localhost:3001/api
   VITE_SOCKET_URL=http://localhost:3001
   ```
2. (Opcional) habilite o proxy em `vite.config.ts` para evitar CORS em dev.
3. Para o chat em tempo real: `npm i socket.io-client` e descomente `connectReal` em `src/api/socket.ts`.

### Contrato de API esperado (REST)

Base: `VITE_API_BASE_URL`. Auth via header `Authorization: Bearer <token>`.

| Recurso | Método | Rota | Observações |
|---|---|---|---|
| Login | POST | `/auth/login` | body `{email,password}` → `{token, user}` |
| Sessão | GET | `/auth/me` | retorna `User` |
| Logout | POST | `/auth/logout` | |
| Usuários (admin) | GET/POST | `/users`, `/users/:id` (PUT) | |
| Profissões (valores distintos) | GET/POST | `/professions` | `collaborators.profession` VARCHAR — não é tabela |
| Creators | GET/POST/PUT | `/creators`, `/creators/:id` | POST cria `users`+`creators` |
| Colaboradores | GET/POST/PUT | `/collaborators`, `/collaborators/:id` | POST cria `users`+`collaborators` |
| Clientes | GET/POST/PUT | `/clients`, `/clients/:id` | `{ id, name, active, created_at }` |
| Tarefas | GET/POST/PUT | `/tasks`, `/tasks/:id` | |
| Tarefa: status | PATCH | `/tasks/:id/status` | body `{status}` — grava `task_status_history` |
| Serviços | GET/POST | `/services` | tabela `collaborator_services` |
| Escala | GET | `/scale-entries?month=YYYY-MM` | `scale_months` + `scale_entries` |
| Escala: atribuir | PUT | `/scale-entries/:work_date` | body `{creator_id}` |
| Ausências | GET | `/absences` | |
| Ausência: solicitar | POST | `/absences` | **creator** (mobile) |
| Ausência: revisar | PATCH | `/absences/:id/review` | **coordenador** — body `{status}` (`approved`/`rejected`); grava `approved_by`/`approved_at` |
| Plantões | GET/POST | `/shifts` | `{ shift_date, creator_id, notes, status }` |
| Mensagens | GET/POST | `/messages?with=:userId` / `/messages` | `{ sender_id, receiver_id, message, is_read }` |
| Notificações | GET | `/notifications` | + POST `/notifications/read-all` |

### Socket.IO (chat)

- Cliente conecta com `auth: { token }`.
- Servidor emite **`message:new`** (payload `Message`).
- Cliente emite **`message:send`** (payload `Message`).

---

## 🗄️ Modelo de dados

`src/types.ts` é a fonte da verdade no frontend e espelha **1:1** o schema Postgres:

`users`, `creators`, `collaborators`, `clients`, `creator_tasks`, `collaborator_services`,
`scale_months`, `scale_entries`, `holidays`, `absences`, `shifts`, `task_status_history`,
`messages`, `notifications`, `attachments`.

> **Sem tabela `professions`** — `collaborators.profession` é `VARCHAR(100)`. O endpoint
> `/professions` apenas devolve os valores distintos já usados (para o autocomplete).
>
> **`creators`/`collaborators`** guardam só `user_id`, `employment_type`, `active` — nome,
> e-mail e telefone vêm de `users` via JOIN (tipos `Creator`/`Collaborator` = `*Row` + JOIN).
>
> **Enums fiéis ao banco**: `absences.status` = `pending`/`approved`/`rejected`;
> `shifts.status` = `pending`/`confirmed`/`completed`/`cancelled`; `employment_type` =
> `fixed`/`freelancer`; `creator_tasks.status` em snake_case PT (`na_fila`, `em_edicao`, …).

As cores/labels de exibição ficam em `src/lib/display.ts` (derivadas, **não** persistidas).

### Regras de negócio refletidas na UI

- **Papéis**: `admin` cria coordenadores (área `/admin`); `gestor` (coordenador) opera tudo;
  `operacional` (creator/colaborador) apenas visualiza no app mobile.
- **Ausências**: o creator **solicita** (mobile); o coordenador **aprova/rejeita** — não cria.
  Ausência aprovada marca o creator como indisponível na Escala.
- **Profissão** é `VARCHAR` em `collaborators.profession` (não é tabela) e pode ser digitada/cadastrada no modal de colaborador.
- **Plantões** são apenas de creators, nos fins de semana.

---

## 📝 Notas

- Os dados mock vivem **em memória** — recarregar a página reseta o estado. Isso é esperado
  até o backend assumir.
- O app mobile do protótipo (telas em frame de celular) não foi portado aqui — o foco desta
  exportação é o **app web do coordenador/admin** e a **camada de dados** para o backend.
  As telas mobile podem ser derivadas dos mesmos endpoints.
