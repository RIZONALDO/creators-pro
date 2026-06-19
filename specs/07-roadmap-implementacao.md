# 07 — Roadmap de Implementação

Sequência faseada para executar depois. Cada fase lista entregáveis, depende da fase anterior (salvo indicado) e uma estimativa de complexidade relativa (não é prazo em dias — depende da equipe).

## Estratégia de testes (vale para toda fase abaixo)

Pra nenhuma fase quebrar o que a anterior já validou, toda fase segue a mesma micro-ordem interna:

```
schema/migration → seed → repository (+ teste unitário) → service (+ teste unitário) → rota/middleware (+ teste de integração)
```

Regras fixas:
- **Nunca avançar de fase com teste vermelho.** Se um teste de uma fase anterior quebrar ao implementar a atual, o problema é tratado antes de continuar — não comentado/skipado "pra depois".
- **O teste de isolamento entre tenants nasce na Fase 1, não na Fase 9.** Cada fase que adiciona um recurso novo (creators, tasks, absences, ...) estende a mesma suíte de isolamento com 1-2 casos novos (`tenant A nunca vê/edita dado do tenant B nesse recurso`), usando o helper `withTwoTenants()` criado na Fase 0. A Fase 9 (Hardening) deixa de ser "a primeira vez que testamos isso" e passa a ser revisão final.

## Fase 0 — Setup do projeto
**Complexidade: pequena**
- Repositório `creatorspro-api` (Express + TypeScript), lint/format (eslint + prettier), `tsconfig` estrito.
- `docker-compose.yml` com Postgres local **+ um segundo serviço `postgres-test`** (schema recriado do zero a cada execução de teste — nunca compartilhar banco com o ambiente de dev).
- `drizzle.config.ts` + estrutura `backend/src/db/schema/` (ver [01](./01-arquitetura-geral.md#estrutura-de-pastas-proposta-backend)).
- Variáveis de ambiente (`DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `PLATFORM_PROVISION_SECRET`, `S3_*`, `SOCKET_CORS_ORIGIN`).
- Script `npm run db:migrate` / `npm run db:seed`.
- **Vitest** configurado + script `npm test` rodando no CI desde o primeiro commit, mesmo sem nenhum teste ainda escrito — o pipeline precisa existir antes do primeiro PR de feature, não ser adicionado depois.
- Helper `withTwoTenants()` em `backend/src/test/helpers/` — cria 2 `companies` + 1 usuário em cada, usado a partir da Fase 1 em toda suíte de isolamento.
- **Critério de saída**: `npm test` roda no CI e passa (vazio), `npm run db:migrate` aplica contra `postgres-test` sem erro.

## Fase 1 — Tenancy & Auth
**Depende de: Fase 0 — Complexidade: média**

Seguindo a micro-ordem padrão:
1. Schema: tabelas `companies`, `users`, `refresh_tokens` (migration via drizzle-kit).
2. Seed: 1 tenant de demonstração + usuários equivalentes ao mock atual do frontend (`fernanda@studionorte.com`, `carlos@studionorte.com`, etc.) — permite trocar `VITE_USE_MOCK=false` e logar com as mesmas credenciais demo já documentadas no README do frontend.
3. Repository de `users`/`refresh_tokens` (+ teste unitário: criar, buscar por e-mail, revogar token).
4. Service de auth — login (bcrypt + emissão de JWT), refresh, logout (+ teste unitário, banco de teste real via `postgres-test`, sem mock de DB).
5. Middleware `authenticate` + `authorize` (ver [03](./03-autenticacao-multitenancy.md)) + rotas `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me` + endpoint interno `/internal/companies` (+ teste de integração subindo o app Express completo).
6. **Primeiro teste de isolamento entre tenants**, usando `withTwoTenants()`: tenant A faz login, tenta acessar `/auth/me` com o token do tenant B → precisa falhar / nunca misturar dados. Essa suíte (`tenant-isolation.test.ts`) é a que todas as fases seguintes vão estender.

- **Critério de saída**: login funcionando fim-a-fim contra o backend real, token validando em uma rota protegida de teste, suíte de isolamento entre tenants criada e verde.

## Fase 2 — Catálogos (creators, collaborators, clients)
**Depende de: Fase 1 — Complexidade: média**
- Tabelas `creators`, `collaborators`, `clients` (schema → seed → repository+teste → service+teste → rotas+teste, mesma micro-ordem da Fase 1).
- CRUD completo + endpoint `/professions`.
- Estender `tenant-isolation.test.ts`: tenant A não lista/edita `creators`/`collaborators`/`clients` do tenant B.
- Tela `Cadastros.tsx` do frontend passa a funcionar contra API real (sem mudança de UI necessária, só trocar `VITE_USE_MOCK`).
- **Critério de saída**: suíte de isolamento estendida e verde, CRUD dos 3 recursos com teste de integração cobrindo criar/listar/atualizar.

## Fase 3 — Tarefas & Serviços
**Depende de: Fase 2 — Complexidade: média/grande**
- Tabela `creator_tasks` + `status_history` (mesma micro-ordem: schema → seed → repository+teste → service+teste → rotas+teste).
- CRUD + `PATCH /tasks/:id/status` (grava histórico — teste dedicado: mudar status grava exatamente 1 linha em `status_history` com `old_status`/`new_status` corretos).
- Tabela `collaborator_services`.
- CRUD + `PUT /services/:id` + `PATCH /services/:id/status` (endpoints novos, não existiam no contrato original — ver [04](./04-contrato-api.md#services)).
- Filtro "ver só o que é meu" para `role=operacional` (ver [06](./06-regras-de-negocio.md)) — **teste obrigatório antes de fechar a fase**: criar 2 creators no mesmo tenant, cada um só vê as próprias tarefas/serviços.
- Estender `tenant-isolation.test.ts` pra `creator_tasks`/`collaborator_services`/`status_history`.
- **Critério de saída**: os dois testes acima (filtro por `operacional` + isolamento entre tenants) verdes, além do teste de histórico de status.

## Fase 4a — Escala & Feriados (sem a validação cruzada com ausências)
**Depende de: Fase 2 (creators) e Fase 1 — Complexidade: grande**

⚠️ Esta fase é dividida em duas partes porque `PUT /scale-entries/:work_date` precisa validar contra `absences.status='approved'`, e `absences` só existe na Fase 5. Construir aqui tudo que **não** depende disso, e fechar a validação cruzada na Fase 4b (depois da 5).

- Tabelas `scale_months`, `scale_entries`, `holidays` (schema → seed → repository+teste → service+teste → rotas+teste).
- Seed de feriados nacionais do ano vigente (`tenant_id = NULL`).
- `GET /scale-entries`, `PUT /scale-entries/:work_date` (**sem** a validação de ausência ainda — só valida fim de semana/feriado).
- `POST /scale-months/:id/auto-assign` (algoritmo round-robin, ver [06](./06-regras-de-negocio.md#escala-automática)) — pula feriados/fins de semana; a parte de "pular ausência aprovada" fica marcada como pendente até a Fase 4b.
- `POST /scale-months/:id/duplicate`.
- `GET/POST /holidays`.
- Estender `tenant-isolation.test.ts` pra `scale_entries`/`holidays`.
- **Critério de saída**: tela Escala do frontend consegue marcar dias com feriado de verdade (hoje é sempre `false` hardcoded); escala automática pula feriados/fins de semana com teste cobrindo isso.

## Fase 5 — Ausências & Plantões
**Depende de: Fase 4a — Complexidade: média**
- Tabela `absences` + fluxo solicitar/revisar (schema → seed → repository+teste → service+teste → rotas+teste).
- Tabela `shifts` + `PUT /shifts/:id` (endpoint novo, necessário pro botão "Trocar creator").
- `status_history` para `absences` e `shifts`.
- Estender `tenant-isolation.test.ts` + repetir o teste "operacional só vê o que é seu" (Fase 3) agora para `absences`/`shifts`.
- **Critério de saída**: solicitar/aprovar/rejeitar ausência testado fim-a-fim; `status_history` gravando para os dois recursos.

## Fase 4b — Fechar a validação cruzada Escala ↔ Ausências
**Depende de: Fase 4a e Fase 5 — Complexidade: pequena**
- `PUT /scale-entries/:work_date` passa a validar: se o `creator_id` enviado tem `absence` aprovada cobrindo a data → `409 ABSENCE_OVERLAPS_SCHEDULE` (ver [06](./06-regras-de-negocio.md#bloqueio-de-escala-por-ausência-aprovada)).
- `POST /scale-months/:id/auto-assign` passa a pular creators com ausência aprovada no round-robin.
- Notificação `alteracao_escala` quando uma ausência é aprovada sobre um dia já escalado (sem remover a atribuição automaticamente — ver [06](./06-regras-de-negocio.md)).
- Teste dedicado: aprovar uma ausência cobrindo um dia já escalado gera a notificação esperada e **não** apaga a atribuição.
- **Critério de saída**: os dois testes (bloqueio no PUT manual + pular na escala automática) verdes.

## Fase 6 — Mensagens & Notificações (+ Socket.IO)
**Depende de: Fase 1 (direto) e Fases 3+5 (para os gatilhos) — Complexidade: média**

`messages`/`notifications` em si só dependem da Fase 1 (usuários). Os **gatilhos** de notificação (tarefa criada, status mudou, ausência revisada, plantão criado) dependem dos eventos das Fases 3 e 5 já existirem — por isso essa fase só fecha de verdade depois delas, mesmo que o REST básico possa ser construído antes.

- Tabelas `messages`, `notifications` (schema → seed → repository+teste → service+teste → rotas+teste).
- REST (`/conversations`, `/messages`, `/notifications`).
- Bootstrap do Socket.IO (auth handshake, rooms `tenant:*`/`user:*`), eventos `message:send`/`message:new`/`notification:new` (ver [05](./05-realtime-socketio.md)) — teste de integração validando que o evento só chega na room `user:<id>` certa (isolamento também vale pro realtime).
- Gatilhos de notificação conectados aos eventos das Fases 3-5 (tarefa criada, status mudou, ausência revisada, plantão criado) — ver tabela em [06](./06-regras-de-negocio.md#gatilhos-de-notificação); 1 teste por gatilho.
- Estender `tenant-isolation.test.ts` pra `messages`/`notifications` (incluindo: socket de um tenant nunca recebe evento de outro).
- **Critério de saída**: cada gatilho da tabela em [06](./06-regras-de-negocio.md) tem teste cobrindo "dispara `notification` + emite `notification:new`".

## Fase 7 — Relatórios
**Depende de: Fases 3 e 5 (precisa de dado real de tasks/services/absences/shifts pra ter o que agregar) — Complexidade: média**
- Endpoints agregados `/reports/*` (ver [04](./04-contrato-api.md#reports-novo--hoje-o-frontend-computa-tudo-no-client-a-partir-de-listas-completas)), incluindo `production-by-creator` (novo, pedido na proposta original e ausente até hoje) — cada endpoint testado com seed determinístico (criar N tasks com datas/status conhecidos, validar o agregado exato, não só "retornou 200").
- Export PDF (`pdfkit`) e Excel (`exceljs`) via `/reports/export`.
- Estender `tenant-isolation.test.ts`: relatório de um tenant nunca soma dado do outro (esse é o tipo de bug que passa despercebido em `SUM`/`COUNT` sem `WHERE tenant_id` — teste explícito é obrigatório aqui).

## Fase 8 — Anexos & Configurações da empresa
**Depende de: Fase 3, Fase 6 — Complexidade: pequena/média**
- Tabela `attachments` (polimórfica) + integração com storage S3-compatible (schema → repository+teste → service+teste → rotas+teste).
- Upload anexado a `tasks`/`services`/`absences`/`shifts`/`messages`.
- Tabela `company_settings` + `GET/PUT /company/settings` (apenas `admin` — teste de RBAC dedicado).
- Estender `tenant-isolation.test.ts` pra `attachments`/`company_settings`.

## Fase 9 — Hardening
**Depende de: todas as anteriores — Complexidade: média**

Como o isolamento entre tenants já vem sendo testado desde a Fase 1 (e estendido em toda fase), esta etapa deixa de ser "a primeira vez que testamos isso" e passa a ser auditoria/performance:

- Revisão de índices (`EXPLAIN ANALYZE` nas queries mais frequentes: Kanban, Escala, Dashboard).
- Rate limiting no `/auth/login` (proteção contra brute-force).
- Logging estruturado + correlação por `tenant_id`/`request_id`.
- **Auditoria final** da suíte `tenant-isolation.test.ts`: revisar se todo endpoint novo criado nas Fases 1-8 de fato tem pelo menos 1 caso ali — usar a lista de rotas em [04-contrato-api.md](./04-contrato-api.md) como checklist de cobertura, não para escrever os testes do zero.
- Avaliar Postgres RLS como camada extra (opcional, ver [01](./01-arquitetura-geral.md#fora-de-escopo-desta-rodada)).
- **Critério de saída**: checklist de cobertura 100% (toda rota do contrato tem teste de isolamento), `EXPLAIN ANALYZE` revisado nas 3 queries mais pesadas.

## Fase 10 — Deploy
**Depende de: Fase 9 — Complexidade: média**
- CI (lint + testes + migration dry-run) em cada PR.
- Estratégia de migrations em produção (rodar `drizzle-kit migrate` antes do deploy da nova versão da API, nunca depois).
- Ambientes: `staging` (1 tenant de teste) e `production`.

---

## Em paralelo: ajustes no frontend

A partir da Fase 1 concluída, o frontend já pode começar a trocar `VITE_USE_MOCK=false` tela por tela e validar contra o backend real. A lista completa de ajustes necessários no frontend (alguns bloqueantes, outros incrementais) está em [08-ajustes-frontend.md](./08-ajustes-frontend.md) — recomenda-se atacá-los na mesma ordem das fases acima (ex.: ajuste de permissões de UI pode começar já na Fase 1/2, ajuste de feriados na Escala só faz sentido depois da Fase 4a).
