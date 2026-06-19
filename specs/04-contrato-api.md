# 04 — Contrato de API REST

Base: `VITE_API_BASE_URL` (ex.: `https://api.creatorspro.com/api`). Toda rota (exceto `/auth/login`, `/auth/refresh` e `/internal/*`) exige header `Authorization: Bearer <access_token>`. O `tenant_id` **nunca** aparece em URL/query/body — é sempre derivado do token (ver [03](./03-autenticacao-multitenancy.md)).

## Convenções

**Envelope de listagem** — toda rota `GET` que retorna lista usa paginação, mesmo que o frontend hoje (mock) devolva array puro:
```json
{ "data": [ ... ], "meta": { "page": 1, "pageSize": 50, "total": 137 } }
```
Query params: `?page=1&pageSize=50`. Esse é o ponto de contrato que **muda** em relação ao mock atual — ver [08-ajustes-frontend.md](./08-ajustes-frontend.md).

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
| POST | `/auth/login` | `{ email, password }` | → `{ token, refreshToken, user }` |
| POST | `/auth/refresh` | `{ refreshToken }` | → `{ token }` (rotaciona o refresh token) |
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
| POST | `/tasks` | |
| PUT | `/tasks/:id` | |
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
| GET | `/scale-entries?month=YYYY-MM` | cria `scale_months` sob demanda se ainda não existir para o mês |
| PUT | `/scale-entries/:work_date` | `{ creator_id }` — valida que o creator não tem ausência aprovada nessa data (`409 ABSENCE_OVERLAPS_SCHEDULE`) e que a data não é feriado/fim de semana (`400 INVALID_WORK_DATE`) |
| POST | `/scale-months/:id/auto-assign` | dispara a escala automática (round-robin, pula ausências/feriados/fins de semana) — ver [06](./06-regras-de-negocio.md) |
| POST | `/scale-months/:id/duplicate` | `{ targetMonth, targetYear }` — duplica as atribuições do mês de origem |
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
| GET | `/shifts` | `operacional` só vê os próprios |
| POST | `/shifts` | |
| PUT | `/shifts/:id` | **novo** — necessário para o botão "Trocar creator" da tela de Plantões, que hoje não tem endpoint de update no contrato |
| PATCH | `/shifts/:id/status` | **novo** — grava em `status_history` |

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

## Socket.IO

Ver [05-realtime-socketio.md](./05-realtime-socketio.md).
