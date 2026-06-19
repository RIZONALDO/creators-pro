# 08 — Ajustes no Frontend Existente

Checklist do que precisa mudar em `frontend/src/` (o frontend já analisado) pra se adequar ao novo modelo de dados/contrato e às lacunas identificadas entre a proposta original e o que foi construído. Nada disso é implementado agora — é a lista a executar depois, na mesma ordem sugerida em [07-roadmap-implementacao.md](./07-roadmap-implementacao.md#em-paralelo-ajustes-no-frontend).

## 1. Contrato de API / tipos (mudança mecânica, não muda UI)

- [ ] `frontend/src/types.ts`: adicionar `avatar_url: string | null` em `User`; trocar `TaskStatusHistory` por um tipo `StatusHistory` genérico (`entity_type`, `entity_id`, `old_status`, `new_status`, `changed_by`, `changed_at`) espelhando a tabela `status_history` (ver [02](./02-modelo-de-dados.md#status_history-substitui-task_status_history--fix-4)); adicionar `CompanySettings` e `AuthSession.refreshToken`.
- [ ] `frontend/src/api/client.ts`: suportar envelope de paginação (`{ data, meta }`) em vez de array puro — todo `list()` em `frontend/src/api/index.ts` passa a desembrulhar `.data`. Hoje o mock devolve array direto; isso é uma mudança de contrato real, não cosmética (ver [04](./04-contrato-api.md#convenções)).
- [ ] `frontend/src/api/client.ts`: implementar refresh automático — interceptar `401`, tentar `POST /auth/refresh` uma vez, repetir a request original; se o refresh falhar, forçar logout.
- [ ] `frontend/src/api/index.ts`: adicionar os grupos novos: `holidaysApi`, `companySettingsApi`, `statusHistoryApi`, `reportsApi` (hoje os relatórios são calculados 100% no client a partir de listas completas — passam a vir prontos do backend, ver [04](./04-contrato-api.md#reports-novo--hoje-o-frontend-computa-tudo-no-client-a-partir-de-listas-completas)).
- [ ] `frontend/src/api/socket.ts`: descomentar/implementar `connectReal()` com `auth: { token }` (já está parcialmente preparado, só falta a implementação real — ver [05](./05-realtime-socketio.md)).

## 2. Permissões por papel (o gap mais importante encontrado na análise da proposta)

Hoje **qualquer usuário não-admin recebe acesso idêntico** a todas as 9 rotas (`App.tsx` não distingue `gestor` de `operacional`). A proposta original é explícita: operacional só visualiza. O backend já vai aplicar isso de verdade ([03](./03-autenticacao-multitenancy.md#matriz-de-permissões-rbac)), mas a UI também precisa parar de oferecer ações que vão retornar `403`:

- [ ] Criar um helper central, ex. `useCan()` no `AppContext`/`AppProvider`, que devolve `can('create', 'task')` etc. a partir do `role` do usuário logado — espelhando a matriz RBAC do backend.
- [ ] `Tasks.tsx`: esconder botão "Nova tarefa", drag-and-drop do Kanban e os controles de mudança de status quando `role === 'operacional'`. A lista já filtrada pelo backend (só as próprias tarefas) — a tela só precisa virar somente-leitura.
- [ ] `Services.tsx`: mesma coisa — somente leitura para `operacional`.
- [ ] `Schedule.tsx`: desabilitar drag-and-drop, "Escala automática" e "Duplicar mês" para `operacional` — ele só visualiza a escala do mês.
- [ ] `Absences.tsx`: tela hoje é só a tabela de aprovação (coordenador). Para `operacional`, trocar por uma view "Minhas ausências" com formulário de solicitação (campos: data inicial, data final, motivo, observação) + lista das próprias solicitações com status. Isso também fecha o gap de "Creator solicita ausência" da proposta, que hoje só existe implicitamente via app mobile (inexistente) — ver item 6.
- [ ] `Shifts.tsx`: somente leitura para `operacional` (vê os próprios plantões, sem criar/trocar).
- [ ] `Cadastros.tsx` e `/cadastros`: esconder do menu/rotas inteiramente para `operacional` (ele não deveria nem navegar pra lá).
- [ ] `Sidebar.tsx`: itens de menu condicionais ao `role` (hoje todos os itens aparecem pra todo mundo que não é admin).

## 3. Funcionalidades que hoje são decorativas/incompletas e passam a ser reais

- [ ] **Notificações** (`Topbar.tsx`): o sino hoje não tem `onClick`, é só um ícone com badge fixo. Construir um dropdown/painel: `GET /notifications` ao abrir, marcar como lida ao clicar, `POST /notifications/read-all`, e assinar `notification:new` via socket pra atualizar em tempo real sem precisar recarregar.
- [ ] **Feriados na Escala** (`Schedule.tsx`): `is_holiday` está hardcoded `false` em todo lugar que cria/atualiza uma `scale_entry` no client. Buscar `GET /holidays?month=` e: (a) desabilitar esses dias como destino de drag-and-drop, (b) renderizar um indicador visual (ex.: o nome do feriado), (c) excluir do algoritmo de "Escala automática" se ela rodar localmente em algum fallback.
- [ ] **Anexos no chat** (`Messages.tsx`): adicionar botão de upload de arquivo/imagem na composer, usando `POST /attachments` com `entity_type='message'` — a proposta original pede isso explicitamente ("Arquivos, Imagens") e a modelagem de dados já suporta, só a UI nunca implementou.
- [ ] **Configurações gerais** (novo, área admin): nova tela/aba em `AdminUsers.tsx` ou uma nova rota `/admin/configuracoes` para editar `company_settings` (nome de exibição, logo, timezone, locale) — fecha a permissão "Configurações gerais" do Admin, que hoje não tem nenhuma tela correspondente.

## 4. Gaps da proposta original que ficaram pendentes na primeira versão do frontend

- [ ] `Services.tsx`: adicionar as visualizações Tabela e Kanban (hoje só existe Cards) — mesmo padrão de `Tasks.tsx`.
- [ ] `Reports.tsx`: adicionar gráfico "Produção por creator" (existe endpoint novo `/reports/production-by-creator`, ver [04](./04-contrato-api.md)); adicionar filtros avançados (período, cliente, creator) ligados aos query params `from`/`to`/`clientId`/`creatorId` dos endpoints de relatório; ligar os botões de exportar PDF/Excel ao `/reports/export` (hoje são apenas visuais).
- [ ] `Dashboard.tsx`: adicionar os 2 widgets que faltam da proposta original — "Escala da semana" e "Plantões do fim de semana" (hoje só existem "Próximas tarefas" e "Ausências pendentes"); considerar adicionar o gráfico "Produção por creator" também aqui, não só em Reports.
- [ ] `Shifts.tsx`: adicionar uma seção/aba de "Histórico" por plantão, consumindo `GET /status-history?entity_type=shift&entity_id=` (endpoint novo, ver [04](./04-contrato-api.md#status-history)) — pedido explícito da proposta original ("Histórico" na seção de Plantões) que nunca foi implementado.

## 5. Design system — itens pedidos na proposta original e ausentes

Ficam mais relevantes a partir daqui porque a rede real introduz latência e erros que hoje (mock instantâneo) não existem:

- [ ] **Toast**: feedback de sucesso/erro em ações assíncronas (criar tarefa, aprovar ausência, falha de rede) — hoje não existe nenhum mecanismo de feedback além do estado da tela mudar silenciosamente.
- [ ] **Skeleton loading**: substituir/complementar o `Spinner` genérico em listas (Kanban, Tabela, Cards) — com latência de rede real, um spinner central é pior experiência que skeletons no formato do conteúdo.
- [ ] **Tooltip**: nice-to-have, não bloqueante.
- [ ] Demais itens da proposta original não encontrados (Date Picker dedicado, Multi Select, Accordion, Drawer, Chip) — avaliar caso a caso conforme as telas dos itens 3-4 forem implementadas; não criar componentes especulativos sem uma tela que os use.

## 6. Preparação para o app mobile (não construir agora)

- [ ] Nenhuma rota REST/Socket precisa mudar para servir o mobile depois — o contrato em [04](./04-contrato-api.md) e [05](./05-realtime-socketio.md) já é desenhado para ambos os clientes.
- [ ] O trabalho do item 2 (Absences com formulário de solicitação para `operacional`) é, na prática, uma versão "provisória no web" do fluxo que a proposta original desenhou para o mobile. Quando o app mobile existir, ele consome os mesmos endpoints — a versão web não precisa ser descartada, pode continuar como fallback para quem acessa via desktop.
