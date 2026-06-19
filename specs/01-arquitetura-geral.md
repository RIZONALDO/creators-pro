# 01 — Arquitetura Geral

> Spec de arquitetura para o backend do CreatorsPro. Não é código — é a base para implementação posterior.

## Stack

| Camada | Escolha | Motivo |
|---|---|---|
| Runtime | Node.js 20 LTS + TypeScript (strict) | Mesma linguagem do frontend, equipe já familiarizada |
| HTTP framework | **Express** | Já prometido no `README.md` do frontend ("Node/Express + Postgres + Socket.IO") — manter a promessa em vez de trocar por Fastify/Nest sem necessidade |
| ORM | **Drizzle ORM** | Já decidido pelo usuário. Schema TS-first, migrations via `drizzle-kit`, sem mágica de decorators |
| Banco | **PostgreSQL 16** | Já decidido. Suporta `pgEnum`, `CHECK`, índices parciais, RLS (opcional) |
| Realtime | **Socket.IO** | Já prometido no README do frontend; `frontend/src/api/socket.ts` já tem o stub esperando isso |
| Auth | JWT (access + refresh) via `jsonwebtoken` | Stateless, fácil de validar em cada request; refresh token persistido para permitir logout real |
| Hash de senha | `bcrypt` | Padrão de mercado |
| Validação | `zod` | Mesma fonte de verdade pode gerar tipos TS compatíveis com `frontend/src/types.ts` |
| Upload/Anexos | S3-compatible (S3, Cloudflare R2 ou MinIO em dev) | `attachments.file_url` aponta pra lá; banco nunca guarda binário |
| Export de relatórios | `pdfkit` (PDF) + `exceljs` (Excel) | Os botões de export hoje são apenas visuais no frontend |

## Decisão central: Multi-tenancy

**Modelo escolhido: single database, shared schema, `tenant_id` denormalizado em toda tabela de negócio.**

Alternativas consideradas e descartadas:

- *Database-per-tenant* — isolamento mais forte, mas migrations e operação ficam N× mais complexas. Overkill no estágio atual.
- *Schema-per-tenant* (Postgres schemas) — meio-termo, mas Drizzle + connection pooling fica mais difícil de gerenciar dinamicamente.
- *Apenas `tenant_id` em `users` e derivar o resto via JOIN* — mais "normalizado", porém qualquer query em `creator_tasks`, `messages` etc. precisaria de JOIN até `users` pra filtrar por tenant. Risco alto de esquecer o filtro e vazar dado entre empresas.

**Por isso**: toda tabela de negócio (exceto tabelas verdadeiramente globais, ver abaixo) ganha uma coluna `tenant_id NOT NULL REFERENCES companies(id)`, com índice composto `(tenant_id, <coluna mais consultada>)`. Toda query do backend passa por um helper que **sempre** injeta `WHERE tenant_id = :tenantId` — nunca confiar em `tenant_id` vindo do client. Detalhes em [02-modelo-de-dados.md](./02-modelo-de-dados.md) e no middleware descrito em [03-autenticacao-multitenancy.md](./03-autenticacao-multitenancy.md).

Tabelas **globais** (sem `tenant_id`, compartilhadas entre todas as empresas):
- `holidays` quando `tenant_id IS NULL` (feriados nacionais) — ver modelo de dados para o híbrido global/por-tenant.

### Resolução de tenant no login

Decisão: **e-mail permanece único globalmente na plataforma** (`UNIQUE(email)` em `users`), não por tenant. O tenant de um usuário é resolvido a partir da própria linha de `users` no momento do login — **não muda a tela de Login do frontend** (sem campo "empresa"/subdomínio).

Trade-off aceito: um e-mail só pode pertencer a uma empresa por vez na plataforma. Se no futuro for necessário o mesmo e-mail em duas agências diferentes (ex.: um freelancer que atende duas produtoras-clientes do CreatorsPro), revisitar para `UNIQUE(tenant_id, email)` + um seletor de empresa no login. Não implementar isso agora — é mais complexidade do que o produto precisa hoje.

### Provisionamento de novo tenant (nova empresa/agência)

Não existe signup self-service na proposta original. Provisionamento de uma nova `company` + seu primeiro usuário `admin` é feito por um **script/endpoint interno protegido por secret de plataforma** (não exposto a usuários finais), rodado pela equipe do CreatorsPro ao fechar um novo cliente. Ver [03-autenticacao-multitenancy.md](./03-autenticacao-multitenancy.md#provisionamento-de-tenant).

## Estrutura de pastas proposta (backend)

Monorepo: `backend/` é irmão de `frontend/` e `specs/` em `/Users/ilha01/creatorspro/` (não é um repositório separado).

```
backend/
├── src/
│   ├── db/
│   │   ├── schema/              # um arquivo por domínio (users.ts, tasks.ts, schedule.ts, ...)
│   │   ├── client.ts             # pool + drizzle()
│   │   └── migrations/           # geradas por drizzle-kit
│   ├── modules/
│   │   ├── auth/                 # login, refresh, logout, middleware
│   │   ├── users/
│   │   ├── creators/
│   │   ├── collaborators/
│   │   ├── clients/
│   │   ├── tasks/
│   │   ├── services/
│   │   ├── schedule/              # scale_months, scale_entries, holidays
│   │   ├── absences/
│   │   ├── shifts/
│   │   ├── messages/
│   │   ├── notifications/
│   │   ├── reports/
│   │   └── company-settings/
│   ├── realtime/
│   │   ├── socket.ts              # bootstrap do Socket.IO
│   │   └── handlers/
│   ├── middleware/
│   │   ├── authenticate.ts        # valida JWT, popula req.auth { userId, tenantId, role }
│   │   ├── authorize.ts           # RBAC por rota
│   │   └── tenantScope.ts         # injeta tenant_id nas queries do módulo
│   ├── lib/                       # zod schemas compartilhados, helpers de erro, paginação
│   └── server.ts
├── drizzle.config.ts
├── docker-compose.yml              # postgres local
└── package.json
```

Cada módulo segue o padrão `routes.ts` → `controller.ts` → `service.ts` → `repository.ts` (repository é o único lugar que toca o Drizzle e é o ponto onde o `tenant_id` é forçado).

## Fora de escopo desta rodada

- App mobile (React Native) — os endpoints são desenhados para servir tanto o web quanto o mobile futuro, mas a implementação do app mobile não está nesta spec.
- Self-service signup / billing de SaaS (cobrança por tenant) — assumido que comercial/onboarding é manual por enquanto.
- Postgres Row-Level Security (RLS) — recomendado como camada extra de defesa, documentado como item do roadmap de hardening ([07-roadmap-implementacao.md](./07-roadmap-implementacao.md)), mas não bloqueia o MVP porque o isolamento via `tenant_id` + repository pattern já é seguro se aplicado de forma consistente.
