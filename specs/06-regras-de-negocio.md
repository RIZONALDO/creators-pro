# 06 — Regras de Negócio

## Escala automática

Endpoint: `POST /scale-months/:id/auto-assign` (ver [04](./04-contrato-api.md)).

Algoritmo (round-robin determinístico, igual ao que o frontend mock já simula no client hoje, só que movido pro backend):

1. Buscar todos os `creators` ativos do tenant (`active = true`).
2. Buscar todos os dias úteis (segunda a sexta) do mês — excluir sábado/domingo.
3. Buscar `holidays` do mês (globais `tenant_id IS NULL` + do tenant) e excluir essas datas também.
4. Para cada dia útil restante, em ordem: atribuir o próximo creator da fila (round-robin), **pulando** quem tiver uma `absence` com `status = 'approved'` cobrindo aquela data.
5. Se todos os creators estiverem em ausência aprovada num dia, o dia fica sem atribuição (`creator_id = NULL`) — a UI já trata isso (`Schedule.tsx` mostra o card vazio/conflito).
6. Grava em `scale_entries` com `is_holiday` calculado (sempre `false` aqui, já que feriados foram excluídos do loop).

## Bloqueio de escala por ausência aprovada

Em `PUT /scale-entries/:work_date` (atribuição manual): antes de salvar, verificar se o `creator_id` enviado tem alguma `absence` com `status = 'approved'` onde `start_date <= work_date <= end_date`. Se sim, `409 ABSENCE_OVERLAPS_SCHEDULE` — a UI já prevê esse conflito visualmente (card em baixa opacidade), o backend só passa a impedir de fato, hoje é só um indicador visual sem validação por trás.

Quando uma ausência é aprovada (`PATCH /absences/:id/review` com `status='approved'`) e o creator já estava escalado em algum dia dentro do período: **não remover automaticamente** a atribuição — emitir uma `notification` pro coordenador (`type: 'alteracao_escala'`) avisando do conflito, para ele decidir manualmente quem cobre. Decisão deliberada: remoção automática poderia silenciosamente deixar um dia sem ninguém escalado sem o coordenador notar.

## Feriados

`holidays` passa a ser consultada de verdade (hoje a coluna `is_holiday` em `scale_entries` é sempre `false`, nunca usada):

- Seed inicial: feriados nacionais brasileiros do ano vigente, com `tenant_id = NULL` (compartilhados por todos os tenants).
- Cada tenant pode adicionar os próprios via `POST /holidays` (ex.: feriado municipal, aniversário da empresa).
- A escala automática e a validação de `PUT /scale-entries/:work_date` consultam `tenant_id = :tenantId OR tenant_id IS NULL`.

## Histórico de status (`status_history`)

Toda rota `PATCH .../status` (tasks, services, shifts) e toda transição de `absences.status` em `/absences/:id/review` grava uma linha em `status_history` **na mesma transação** que atualiza a tabela principal — nunca como um passo separado que pode falhar silenciosamente. Campos: `entity_type`, `entity_id`, `old_status` (o valor antes do update), `new_status`, `changed_by` (vem de `req.auth.userId`, nunca do body).

## Gatilhos de notificação

| Evento | Quem recebe `notification` | `type` |
|---|---|---|
| Tarefa criada/atribuída a um creator | o creator (`users.id` ligado ao `creator_id`) | `nova_tarefa` |
| Status de tarefa muda | o creator responsável + o `created_by` (coordenador que criou) | `mudanca_status` |
| Ausência aprovada | o creator que solicitou | `ausencia_aprovada` |
| Ausência rejeitada | o creator que solicitou | `ausencia_rejeitada` |
| Plantão criado/atribuído | o creator designado | `novo_plantao` |
| Escala alterada manualmente, ou conflito de ausência aprovada com escala existente (ver acima) | coordenador(es) (`role IN ('gestor','admin')` do tenant) | `alteracao_escala` |

Cada gatilho: (1) insere a linha em `notifications`, (2) emite `notification:new` via Socket.IO pra `user:<user_id>` do destinatário (ver [05](./05-realtime-socketio.md)). As duas ações ficam na mesma função de serviço — nunca duplicar essa lógica entre o handler REST e o handler do socket.

## Permissão "operacional só visualiza" (reforço)

Essa regra já está detalhada como matriz em [03-autenticacao-multitenancy.md](./03-autenticacao-multitenancy.md#matriz-de-permissões-rbac) — mencionada aqui só para deixar explícito que ela é tratada como **regra de negócio**, não só como configuração de rota: o filtro "ver somente o que é meu" em `tasks`/`services`/`shifts`/`absences` para `operacional` é resolvido no service layer (via `creator_id`/`collaborator_id` ligado ao `user_id` do token), não em uma checagem solta no controller — isso evita que alguém esqueça o filtro ao adicionar um novo endpoint de listagem no futuro.
