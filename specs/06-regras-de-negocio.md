# 06 — Regras de Negócio

## Escala automática

Endpoint: `POST /scale-months/:id/auto-assign` (ver [04](./04-contrato-api.md)).

Algoritmo (round-robin determinístico, igual ao que o frontend mock já simula no client hoje, só que movido pro backend):

1. Buscar todos os `creators` ativos do tenant (`active = true`), **ordenados por `scale_order`** (não por ordem de criação) — essa ordem é definida pelo usuário arrastando os creators entre si na paleta da tela de Escala (`PUT /creators/reorder`), default todos em `0` (mantém a ordem de criação até alguém reordenar pela primeira vez).
2. Buscar todos os dias úteis (segunda a sexta) do mês — excluir sábado/domingo.
3. Buscar `holidays` do mês (globais `tenant_id IS NULL` + do tenant) e excluir essas datas também.
4. Para cada dia útil restante, em ordem: atribuir o próximo creator da fila (round-robin), **pulando** quem tiver uma `absence` com `status = 'approved'` cobrindo aquela data.
5. Se todos os creators estiverem em ausência aprovada num dia, o dia fica **sem nenhuma linha** em `scale_entries` (não força ninguém ausente) — a UI mostra o card vazio, pronto pra atribuição manual via drag.
6. Antes do passo 1, **limpa todas as linhas do mês** (`scale_month_id`) — rodar de novo depois de atribuições manuais (drag) regenera do zero, não mistura o que sobrou de uma rodada anterior.
7. Grava em `scale_entries` com `is_holiday` calculado (sempre `false` aqui, já que feriados foram excluídos do loop).

Depois de rodar a escala automática, o quadro (`Schedule.tsx`) aceita edição manual via drag: mover um creator de um dia pra outro (`DELETE` na origem + `POST` no destino), remover um creator de um dia sem afetar os demais, ou adicionar mais de 1 creator no mesmo dia — `scale_entries` permite isso desde que a unique passou a ser `(tenant_id, work_date, creator_id)`, não mais `(tenant_id, work_date)` (ver [02](./02-modelo-de-dados.md)).

## Bloqueio de escala por ausência aprovada

Em `POST /scale-entries/:work_date` (atribuição manual — adiciona, não substitui): antes de salvar, verificar se o `creator_id` enviado tem alguma `absence` com `status = 'approved'` onde `start_date <= work_date <= end_date`. Se sim, `409 ABSENCE_OVERLAPS_SCHEDULE` — a UI já prevê esse conflito visualmente (card em baixa opacidade), o backend só passa a impedir de fato, hoje é só um indicador visual sem validação por trás. Também rejeita com `409 ALREADY_ASSIGNED` se esse mesmo creator já está nesse dia (mas permite creators *diferentes* no mesmo dia).

Quando uma ausência é aprovada (`PATCH /absences/:id/review` com `status='approved'`) e o creator já estava escalado em algum dia dentro do período: **não remover automaticamente** a atribuição — emitir uma `notification` pro coordenador (`type: 'alteracao_escala'`) avisando do conflito, para ele decidir manualmente quem cobre. Decisão deliberada: remoção automática poderia silenciosamente deixar um dia sem ninguém escalado sem o coordenador notar.

## Bloqueio de tarefa por ausência aprovada + data mínima ("limit-min-date")

Mesma regra de ausência da escala, agora também em `POST /tasks` e `PUT /tasks/:id`: se `creator_id` e `task_date` resolverem (o que veio no corpo, ou — no PUT, quando o campo não foi enviado — o valor que a tarefa já tinha) para um creator com `absence` aprovada cobrindo aquela data, `409 ABSENCE_OVERLAPS_TASK`. No `PUT`, essa checagem só roda quando `creator_id` e/ou `task_date` estão de fato no corpo da requisição — editar só o título de uma tarefa que "ficou desatualizada" porque uma ausência foi aprovada depois **não trava** (mesma filosofia do bloqueio de escala: não desfaz nada retroativamente).

Separado disso, **toda** `task_date` enviada (criação ou edição) precisa ser hoje ou no futuro — `task_date` anterior à data atual (UTC, mesmo critério de [`isWeekday`](../backend/src/modules/schedule/schedule.dates.ts)) é `400 TASK_DATE_IN_PAST`. Não permite criar/editar tarefa retroativa. O `DatePicker` do frontend espelha isso visualmente (dias antes de hoje aparecem desabilitados), mas a validação de verdade é no backend.

## Feriados

`holidays` passa a ser consultada de verdade (hoje a coluna `is_holiday` em `scale_entries` é sempre `false`, nunca usada):

- Seed inicial: feriados nacionais brasileiros do ano vigente, com `tenant_id = NULL` (compartilhados por todos os tenants).
- Cada tenant pode adicionar os próprios via `POST /holidays` (ex.: feriado municipal, aniversário da empresa).
- A escala automática e a validação de `POST /scale-entries/:work_date` consultam `tenant_id = :tenantId OR tenant_id IS NULL`.

## Histórico de status (`status_history`)

Toda rota `PATCH .../status` (tasks, services, shifts) e toda transição de `absences.status` em `/absences/:id/review` grava uma linha em `status_history` **na mesma transação** que atualiza a tabela principal — nunca como um passo separado que pode falhar silenciosamente. Campos: `entity_type`, `entity_id`, `old_status` (o valor antes do update), `new_status`, `changed_by` (vem de `req.auth.userId`, nunca do body).

### `shifts.status` — simplificado pra 3 estados (pedido direto, não fazia parte do roadmap original)

A versão original tinha `pending`/`confirmed`/`completed`/`cancelled`. Auditoria encontrou que `pending`/`confirmed` nunca tiveram função real: quem cria o plantão é o gestor (`POST /shifts`), e quem muda o status depois é o próprio gestor (`PATCH /shifts/:id/status` é RBAC `admin`/`gestor` — não existe fluxo de creator "confirmando" o próprio plantão no PWA). Sem ação de terceiro, sem notificação, sem relatório que diferencie os dois — era a mesma pessoa marcando a mesma coisa duas vezes.

Ficou em 3 estados, cada um com desfecho real: `scheduled` (default — vai acontecer), `completed` (aconteceu — único valor que alimenta `GET /reports/shifts-completed`, ver [04](./04-contrato-api.md#reports-novo--hoje-o-frontend-computa-tudo-no-client-a-partir-de-listas-completas)), `cancelled` (foi chamado, mas não vai acontecer — diferente de excluir o registro). Migração de dados (`0016_hot_santa_claus.sql`): linhas com `pending`/`confirmed` foram convertidas pra `scheduled`.

**Pendência consciente**: `completed` ainda é 100% manual (gestor lembra de marcar depois que o plantão passou) e não há validação de data — dá pra marcar `completed` num plantão futuro. Se o relatório alimentar pagamento, vale considerar automatizar ou pelo menos bloquear `completed` em data futura.

## Gatilhos de notificação

| Evento | Quem recebe `notification` | `type` |
|---|---|---|
| Tarefa criada/atribuída a um creator | o creator (`users.id` ligado ao `creator_id`) | `nova_tarefa` |
| Status de tarefa muda | o creator responsável + o `created_by` (coordenador que criou) | `mudanca_status` |
| Ausência aprovada | o creator que solicitou | `ausencia_aprovada` |
| Ausência rejeitada | o creator que solicitou | `ausencia_rejeitada` |
| Plantão criado/atribuído | o creator designado (titular) | `novo_plantao` |
| Plantão ganha sobreaviso novo (criação ou `PUT` adicionando à lista) | cada creator em `standby_creator_ids` que **não** estava na lista antes — mesmo `type`, título "Sobreaviso de plantão" em vez de "Novo plantão" | `novo_plantao` |
| Escala alterada manualmente, ou conflito de ausência aprovada com escala existente (ver acima) | coordenador(es) (`role IN ('gestor','admin')` do tenant) | `alteracao_escala` |

Cada gatilho: (1) insere a linha em `notifications`, (2) emite `notification:new` via Socket.IO pra `user:<user_id>` do destinatário (ver [05](./05-realtime-socketio.md)). As duas ações ficam na mesma função de serviço — nunca duplicar essa lógica entre o handler REST e o handler do socket.

**Sobreaviso de plantão** (não fazia parte do roadmap original, pedido direto): além do plantonista titular (`shifts.creator_id`), um plantão pode ter 0+ creators de sobreaviso (`shift_standbys`). Eles recebem a mesma notificação `novo_plantao` do titular (só o título distingue o papel) e passam a ver o plantão na própria lista (`GET /shifts`), mesmo não sendo o titular — sem isso, a notificação seria um beco sem saída (avisa, mas a pessoa não acha o plantão na tela dela). `PUT /shifts/:id` com `standby_creator_ids` substitui a lista inteira; só quem é novo na lista é notificado de novo (evita reenviar pra quem já sabia).

## Permissão "operacional só visualiza" (reforço)

Essa regra já está detalhada como matriz em [03-autenticacao-multitenancy.md](./03-autenticacao-multitenancy.md#matriz-de-permissões-rbac) — mencionada aqui só para deixar explícito que ela é tratada como **regra de negócio**, não só como configuração de rota: o filtro "ver somente o que é meu" em `tasks`/`services`/`shifts`/`absences` para `operacional` é resolvido no service layer (via `creator_id`/`collaborator_id` ligado ao `user_id` do token), não em uma checagem solta no controller — isso evita que alguém esqueça o filtro ao adicionar um novo endpoint de listagem no futuro.
