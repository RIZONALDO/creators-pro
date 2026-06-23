# 04 — Contrato de API REST

Base: `VITE_API_BASE_URL` (ex.: `https://api.creatorspro.com/api`). Toda rota (exceto `/auth/login`, `/auth/refresh` e `/internal/*`) exige header `Authorization: Bearer <access_token>`. O `tenant_id` **nunca** aparece em URL/query/body — é sempre derivado do token (ver [03](./03-autenticacao-multitenancy.md)).

## Convenções

**Casing**: toda chave JSON — request e response — é `snake_case` (`tenant_id`, `format_type`, `shift_date`...), igual aos nomes de coluna do banco e ao `frontend/src/types.ts`. O Drizzle nomeia objetos JS internamente em camelCase (`tenantId`); o backend converte automaticamente na saída via um middleware global (`snakeCaseResponse`, intercepta `res.json`) — nenhuma rota individual precisa se preocupar com isso. Só os VALORES nunca são tocados (ex.: código de erro `ABSENCE_OVERLAPS_SCHEDULE` continua maiúsculo), só as chaves dos objetos.

**Envelope de listagem** — toda rota `GET` que retorna lista usa paginação, mesmo que o frontend hoje (mock) devolva array puro:
```json
{ "data": [ ... ], "meta": { "page": 1, "page_size": 50, "total": 137 } }
```
Query params: `?page=1&pageSize=50` (nos query strings, não há conversão de casing — só no corpo da resposta). Esse é o ponto de contrato que **muda** em relação ao mock atual — ver [08-ajustes-frontend.md](./08-ajustes-frontend.md).

**Erros** — formato único:
```json
{ "error": { "code": "ABSENCE_OVERLAPS_SCHEDULE", "message": "Creator já possui ausência aprovada nesse período." } }
```
`code` é estável e usado pelo frontend pra mensagens específicas; `message` é texto amigável (pt-BR) de fallback.

**Status codes**: `200` ok, `201` criado, `204` sem corpo (ex.: logout), `400` validação, `401` não autenticado, `403` sem permissão (RBAC), `404` não encontrado *ou* pertence a outro tenant (nunca diferenciar os dois — não dar pista de que o recurso existe em outro tenant), `409` conflito (ex.: e-mail duplicado, dia da escala já ocupado).

**Validação**: cada body é validado por um schema `zod` espelhando `frontend/src/types.ts` (`NewTask`, `NewAbsence`, etc.) — o objetivo é que o schema zod do backend (`backend/`) e o tipo TS do frontend nunca fiquem fora de sincronia; podem inclusive ser gerados de uma fonte única no futuro (`zod-to-ts`).

---

## Auth

| Método | Rota | Body | Observações |
|---|---|---|---|
| POST | `/auth/login` | `{ email, password }` | → `{ token, refresh_token, user }` |
| POST | `/auth/refresh` | `{ refresh_token }` | → `{ token }` (rotaciona o refresh token) |
| POST | `/auth/logout` | — | revoga o refresh token atual |
| GET | `/auth/me` | — | → `User` atual |

## Users (admin only)

| Método | Rota | Observações |
|---|---|---|
| GET | `/users` | lista usuários do tenant |
| POST | `/users` | cria usuário (`role`, `status`, senha inicial) |
| PUT | `/users/:id` | atualiza dados/role/status |

## Professions

| Método | Rota | Observações |
|---|---|---|
| GET | `/professions` | valores distintos já usados em `collaborators.profession` do tenant + lista default (seed) |
| POST | `/professions` | apenas para autocomplete — não persiste em tabela própria, é eco do valor digitado |

## Creators / Collaborators / Clients

| Método | Rota | Observações |
|---|---|---|
| GET | `/creators` | |
| POST | `/creators` | cria `users` (role implícito ligado ao perfil) + `creators` numa transação |
| PUT | `/creators/:id` | |
| PUT | `/creators/reorder` | `{ creator_ids }` (array completo, na ordem desejada) — define `scale_order`, usado pelo round-robin de `POST /scale-months/:id/auto-assign`. Registrada **antes** de `PUT /creators/:id` no router (senão Express casaria "reorder" com `:id`) |
| GET | `/collaborators` | |
| POST | `/collaborators` | cria `users` + `collaborators` numa transação |
| PUT | `/collaborators/:id` | |
| GET | `/clients` | |
| POST | `/clients` | |
| PUT | `/clients/:id` | |

`operacional` recebe `403` em todas as rotas de escrita acima e também em `GET /clients` (ver matriz RBAC em [03](./03-autenticacao-multitenancy.md)).

## Tasks

| Método | Rota | Observações |
|---|---|---|
| GET | `/tasks` | `operacional` recebe automaticamente filtrado por `creator_id` próprio (não é um query param manipulável pelo client) |
| POST | `/tasks` | `task_date` retroativo (anterior a hoje) → `400 TASK_DATE_IN_PAST` ("limit-min-date"). `creator_id` com ausência aprovada cobrindo `task_date` → `409 ABSENCE_OVERLAPS_TASK` (mesma regra do `POST /scale-entries/:work_date`) |
| PUT | `/tasks/:id` | Mesmas duas validações do POST — só dispara quando `creator_id` e/ou `task_date` estão de fato no corpo (editar outro campo sem tocar nesses dois nunca revalida, mesmo se uma ausência tiver sido aprovada depois) |
| PATCH | `/tasks/:id/status` | `{ status }` — grava em `status_history` (`entity_type='task'`) |

## Services

| Método | Rota | Observações |
|---|---|---|
| GET | `/services` | mesmo filtro implícito para `operacional` |
| POST | `/services` | |
| PUT | `/services/:id` | **novo** — hoje só existe GET/POST no contrato atual; sem isso não dá pra editar nem mudar status de um serviço já criado |
| PATCH | `/services/:id/status` | **novo** — grava em `status_history` (`entity_type='service'`) |

## Escala (Schedule) + Holidays

| Método | Rota | Observações |
|---|---|---|
| GET | `/scale-entries?month=YYYY-MM` | cria `scale_months` sob demanda se ainda não existir para o mês; só devolve linhas com atribuição real (sem placeholder) |
| POST | `/scale-entries/:work_date` | `{ creator_id }` — **adiciona** 1 creator a 1 dia (não substitui quem já estiver lá — mais de 1 por dia é permitido). Valida ausência aprovada (`409 ABSENCE_OVERLAPS_SCHEDULE`), feriado/fim de semana (`400 INVALID_WORK_DATE`) e duplicidade (`409 ALREADY_ASSIGNED` se esse creator já está nesse dia) |
| DELETE | `/scale-entries/:work_date/:creator_id` | remove só esse creator desse dia, sem afetar outros atribuídos no mesmo dia (`404 ASSIGNMENT_NOT_FOUND` se não estava lá) |
| POST | `/scale-months/:id/auto-assign` | dispara a escala automática (round-robin, pula ausências/feriados/fins de semana) — **limpa todas as linhas do mês antes de regenerar** — ver [06](./06-regras-de-negocio.md) |
| POST | `/scale-months/:id/duplicate` | `{ targetMonth, targetYear }` — duplica as atribuições do mês de origem (todos os creators de cada dia, não só 1) — limpa o mês de destino antes de regenerar |
| GET | `/holidays?month=YYYY-MM` | retorna feriados globais (`tenant_id IS NULL`) + os do tenant |
| POST | `/holidays` | cria feriado específico do tenant |

## Absences

| Método | Rota | Observações |
|---|---|---|
| GET | `/absences` | `operacional` só vê as próprias |
| POST | `/absences` | `{ creator_id, start_date, end_date, reason }` — `operacional` só pode informar o próprio `creator_id` |
| PATCH | `/absences/:id/review` | `{ status: 'approved' \| 'rejected' }` — só `gestor`/`admin`; grava `approved_by`/`approved_at` e, se aprovado, bloqueia a(s) data(s) na escala |

## Shifts

| Método | Rota | Observações |
|---|---|---|
| GET | `/shifts` | `operacional` vê os próprios plantões **e** os que está de sobreaviso (`creator_id = eu` OU `eu ∈ standby_creator_ids`) — cada linha inclui `standby_creator_ids: string[]`, `creator_name: string \| null` e `standby_names: string[]` (resolvidos pela API: `operacional` não tem `GET /creators` pra resolver o nome de quem não é ele mesmo) |
| POST | `/shifts` | `{ ..., standby_creator_ids?: string[] }` — sobreaviso (não fazia parte do roadmap original): recebe a mesma notificação `novo_plantao` do titular |
| PUT | `/shifts/:id` | `standby_creator_ids` **substitui** a lista inteira (não soma); só notifica quem é novo na lista, não quem já estava |
| PATCH | `/shifts/:id/status` | grava em `status_history` |
| DELETE | `/shifts/:id` | apenas `admin`/`gestor` — apaga o `status_history` do plantão antes (mesmo padrão de tasks/services); `shift_standbys` some via `ON DELETE CASCADE` |

## Status history

| Método | Rota | Observações |
|---|---|---|
| GET | `/status-history?entity_type=task&entity_id=:id` | **novo** — alimenta qualquer tela de "Histórico" (ex.: Plantões, conforme pedido na proposta original) |

## Messages

| Método | Rota | Observações |
|---|---|---|
| GET | `/conversations` | lista de conversas do usuário logado |
| GET | `/messages?with=:userId` | thread com um usuário específico |
| POST | `/messages` | `{ receiver_id, message }` — dispara evento Socket.IO `message:new` para o destinatário |

## Notifications

| Método | Rota | Observações |
|---|---|---|
| GET | `/notifications` | |
| POST | `/notifications/read-all` | |

## Company Settings (novo)

| Método | Rota | Observações |
|---|---|---|
| GET | `/company/settings` | qualquer usuário autenticado (precisa do nome/logo da empresa pra UI) |
| PUT | `/company/settings` | apenas `admin` |

## Reports (novo — hoje o frontend computa tudo no client a partir de listas completas)

| Método | Rota | Observações |
|---|---|---|
| GET | `/reports/production-monthly?from=&to=` | série mensal de entregas |
| GET | `/reports/production-by-client?from=&to=` | |
| GET | `/reports/production-by-creator?from=&to=` | **novo** — pedido na proposta original, não existe hoje nem no frontend |
| GET | `/reports/shifts-completed?from=&to=` | |
| GET | `/reports/absences?from=&to=` | |
| GET | `/reports/approved-deliveries?from=&to=` | |
| GET | `/reports/export?type=monthly\|client\|creator&format=pdf\|excel` | gera arquivo (ver `pdfkit`/`exceljs` em [01](./01-arquitetura-geral.md)) |

Todos aceitam `clientId`/`creatorId` como filtro adicional — fecha o gap de "filtros avançados" identificado na análise da proposta.

## Internal (provisionamento de tenant)

| Método | Rota | Observações |
|---|---|---|
| POST | `/internal/companies` | protegido por secret de plataforma, não por JWT de usuário — ver [03](./03-autenticacao-multitenancy.md#provisionamento-de-tenant) |

## Billing (Fase 9.1 — self-service signup, não fazia parte do roadmap original)

| Método | Rota | Body | Observações |
|---|---|---|---|
| POST | `/signup` | `{ company_name, admin_name, admin_email, admin_password }` | público, rate-limited (5/h por IP) — devolve `{ checkout_url }`. Não cria empresa/admin ainda: só depois do pagamento confirmar (webhook) |
| POST | `/billing/webhook` | evento Stripe (corpo cru) | público, verificado por assinatura (`stripe-signature`), não por JWT — `checkout.session.completed` cria a empresa+admin; `customer.subscription.deleted`/`invoice.payment_failed` suspendem; `customer.subscription.updated` reativa |
| POST | `/billing/portal` | — | apenas `admin`, autenticado — devolve `{ portal_url }` (Stripe Customer Portal) |

`POST /auth/login` (seção Auth acima) ganhou uma checagem adicional: `company.status !== 'active'` devolve `402 SUBSCRIPTION_INACTIVE`, não `401`.

## Socket.IO

Ver [05-realtime-socketio.md](./05-realtime-socketio.md).
