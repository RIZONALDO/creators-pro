# specs/ — CreatorsPro Backend

Especificações de arquitetura para o backend do CreatorsPro (Node + Express + Drizzle + PostgreSQL + Socket.IO, **multi-tenant**). São documentos de design para execução posterior — nenhum código de produção foi escrito ainda.

Contexto: o frontend (`frontend/src/`) já existe e roda 100% sobre dados mock (`frontend/src/api/mock.ts`). Estas specs definem o backend real (pasta `backend/`) que vai substituir o mock, mais os ajustes necessários no frontend pra se adequar ao modelo de dados final e à proposta original do produto.

Estrutura do monorepo:
```
/Users/ilha01/creatorspro/
├── backend/     # estas specs descrevem o que entra aqui
├── frontend/    # já existe, hoje roda 100% sobre mock
└── specs/       # você está aqui
```

## Ordem de leitura recomendada

1. [01-arquitetura-geral.md](./01-arquitetura-geral.md) — stack, decisão de multi-tenancy e por quê, estrutura de pastas.
2. [02-modelo-de-dados.md](./02-modelo-de-dados.md) — schema completo (todas as tabelas, enums, constraints, índices), com os gaps da modelagem original já corrigidos.
3. [03-autenticacao-multitenancy.md](./03-autenticacao-multitenancy.md) — login, JWT, refresh/logout, provisionamento de tenant, matriz de permissões (RBAC) por papel.
4. [04-contrato-api.md](./04-contrato-api.md) — todos os endpoints REST, convenções de paginação/erro/validação.
5. [05-realtime-socketio.md](./05-realtime-socketio.md) — auth do socket, rooms por tenant/usuário, eventos.
6. [06-regras-de-negocio.md](./06-regras-de-negocio.md) — escala automática, feriados, histórico de status, gatilhos de notificação.
7. [07-roadmap-implementacao.md](./07-roadmap-implementacao.md) — sequência faseada de implementação, do setup ao deploy.
8. [08-ajustes-frontend.md](./08-ajustes-frontend.md) — checklist do que muda no frontend existente (permissões na UI, features hoje decorativas, gaps da proposta original, design system).

## Decisões já tomadas (não reabrir sem motivo novo)

- Multi-tenant via `tenant_id` denormalizado em toda tabela de negócio — não database-per-tenant, não schema-per-tenant.
- E-mail único globalmente na plataforma (não por tenant) — tenant é resolvido a partir do usuário no login, sem campo de empresa na tela de Login.
- Sem signup self-service — provisionamento de tenant é manual, via endpoint interno protegido por secret de plataforma.
- `Express` (não Fastify/Nest) — já era a promessa registrada no `README.md` do frontend.
- `status_history` polimórfica única, substituindo a ideia original de `task_status_history` isolada — cobre tasks, absences, shifts e services com a mesma estrutura (mesmo padrão já usado em `attachments`).

Essas decisões têm o "porquê" documentado inline em cada arquivo — se alguma precisar mudar, edite o arquivo correspondente em vez de decidir de novo do zero numa conversa futura.
