# 08 — Plano de Implementação do Frontend

Consolida 3 fontes de gap analysis feitas ao longo do projeto: (1) proposta original vs. primeira versão do frontend, (2) `template de referencias/CreatorsPro.dc.html` (o HTML de alta-fidelidade em que o frontend foi baseado) vs. o que foi de fato implementado, e (3) o que o backend real (Fases 0–5+4b, módulo `/users`, exclusão física) já suporta hoje.

**Critério de ordenação das fases: dependência de backend.** Itens que o backend já atende hoje vêm primeiro; itens que dependem de uma fase do backend ainda não construída (Fase 6 — mensagens/notificações/Socket.IO; Fase 8 — anexos/configurações; e um fluxo de reset de senha que não está em nenhuma fase) ficam por último, marcados como bloqueados.

## Já feito (não repetir)

- ✅ Envelope de paginação (`http.getList`) e unwrap de `/auth/me` (`{user}`).
- ✅ Senha demo dos botões de login corrigida (`demo1234`), `.env`/`.env.example` sem sufixo `/api`.
- ✅ Editar + excluir em `Tasks.tsx`, `Services.tsx`, `Cadastros.tsx` (creators/collaborators/clients) — clique abre modal preenchido, "Excluir" dentro do modal, erros de bloqueio (409) exibidos.
- ✅ `servicesApi.update`/`setStatus`, `tasksApi.remove`, `creatorsApi.remove`, `collaboratorsApi.remove`, `clientsApi.remove` no `api/index.ts`.

---

## Fase F1 — RBAC na UI ✅ concluída (o gap mais importante, backend já aplica os `403`)

Hoje qualquer usuário não-admin vê e faz tudo (`App.tsx` não distingue `gestor` de `operacional`). O backend já bloqueia via `403`; sem isso a UI oferece ações que vão falhar silenciosamente ou com erro confuso.

- [x] `useCan()` em `lib/permissions.ts` — espelha a matriz RBAC de `specs/03-autenticacao-multitenancy.md`.
- [x] `Tasks.tsx`: somente leitura pra `operacional`.
- [x] `Services.tsx`: mesma coisa.
- [x] `Schedule.tsx`: desabilitar drag-and-drop, "Escala automática", "Duplicar mês".
- [x] `Shifts.tsx`: somente leitura (vê os próprios plantões).
- [x] `Cadastros.tsx` + rota `/cadastros`: esconde inteiramente pra `operacional`.
- [x] `Sidebar.tsx`/`MobileNav.tsx`: itens de menu condicionais ao `role`.
- [x] `Absences.tsx`: `operacional` vê "Minhas ausências" (formulário de solicitação + lista própria) em vez da tabela de aprovação.

## Fase F2 — Backend já pronto, só falta a UI ✅ concluída

Nenhum destes precisava de endpoint novo — só consumir o que já existia e foi confirmado funcionando nos testes do backend.

- [x] **Feriados na Escala** (`Schedule.tsx`): `GET /holidays?month=` consumido; dias de feriado ficam desabilitados pra drag-and-drop/escala automática e mostram o nome do feriado (coordenador e operacional).
- [x] **Histórico de plantão** (`Shifts.tsx`): botão "Histórico" por plantão consumindo `GET /status-history?entity_type=shift&entity_id=`; status do plantão passou a ser editável (faltava `shiftsApi.setStatus`/`PATCH /shifts/:id/status`, sem isso a tabela nunca teria registros).
- [x] **Services: views Tabela e Kanban** — implementado, mas o Kanban foi removido depois por decisão explícita (ver "Trabalho adicional" abaixo): Tasks e Services ficaram só com Tabela/Cards/Timeline.
- [x] **Tasks: filtros por Cliente e Status** + botão "Limpar" (componente `FilterChip` compartilhado, também usado em Reports).
- [x] **Messages: busca de conversa** — filtro client-side sobre `GET /conversations`.
- [x] **Reports**: filtros Período/Cliente/Creator + gráfico "Produção por creator" ao lado de "Produção por cliente".
- [x] **Dashboard**: widgets "Escala da semana" (grade dos 5 dias úteis com quem está escalado) e "Plantões do fim de semana" (próximos plantões de sáb/dom).
- [x] **Login**: checkbox "Lembrar-me" — persiste e-mail em `localStorage`.
- [x] `client.ts`: refresh automático em `401` + reidratação de sessão num reload de página. Achado de carona: `refresh_token` nunca era persistido (`AuthSession` nem declarava o campo) e `POST /auth/logout` nunca enviava o `refresh_token` no corpo — os dois corrigidos junto, senão o refresh automático não tinha como funcionar.

## Fase F3 — Design system ✅ concluída (sem dependência de backend)

Confirmados no HTML de referência (seção "Design System", linhas ~1021-1100) e ausentes do código:

- [x] **Date picker dedicado** (`components/DatePicker.tsx`): calendário próprio (navegação por mês, grade dom-sáb, gradiente de seleção) substituindo `<input type="date">` em Tasks/Services/Shifts/Absences. Tematização dark/light automática (só usa as CSS vars já existentes, sem lógica extra). Ganhou uma prop `large` pra escala mobile (usada em Absences). Testamos o `<input type="date">` nativo no formulário mobile "Solicitar ausência" primeiro — em navegador mobile real ele renderizava sem nenhuma indicação quando vazio (parecia bug de placeholder, não era: é só como o nativo se comporta) — revertido pro `DatePicker` customizado, que resolve isso em qualquer navegador/SO.
- [x] **Toast** (`context/ToastContext.tsx` + `components/Toast.tsx`): 3 variantes fiéis à referência (success/warning/error, ícone + `border-left` colorido). Substituiu os 8 `alert()` de erro que existiam em Tasks/Services/Shifts/Cadastros/Absences, e ganhou feedback de sucesso (antes inexistente) em criar/editar/excluir tarefa/serviço/plantão/creator/colaborador/cliente e aprovar/rejeitar ausência.
- [x] **Skeleton loading** (`components/Skeleton.tsx` + keyframe `cpShimmer` em `theme.css`): aplicado em Tasks/Services/Cadastros (3 abas) usando o `loading` que `useAsync()` já devolvia e nenhuma tela consumia — antes a lista aparecia vazia por um instante (parecia "sem dados"), não "carregando". Reports/Dashboard/Schedule/Messages ficaram de fora por proporcionalidade (layouts mais complexos, carregam rápido na prática).
- [x] **Chips removíveis** (`components/Chip.tsx`): aplicado nos filtros ativos de Tasks.tsx e Reports.tsx — cada filtro ativo (Cliente/Status/Período/Creator) agora é um chip individual removível, com "Limpar tudo" só quando 2+ estão ativos ao mesmo tempo (antes, em Tasks, um único "Limpar" zerava tudo de uma vez; em Reports não havia nenhuma forma de limpar um filtro sem reabrir o dropdown).
- Tooltip/Accordion/Drawer: avaliar caso a caso conforme novas telas surgirem — não construído especulativamente, nenhuma tela hoje precisa.

## Fase F4 — ✅ concluída (backend Fase 6 + UI)

Backend da Fase 6 (`specs/07-roadmap-implementacao.md#fase-6--mensagens--notificações--socketio`) concluído: módulos `notifications`/`messages` (schema, repository, service, rotas, testes), gatilhos conectados a tasks/absences/shifts (`nova_tarefa`, `mudanca_status`, `ausencia_aprovada`, `ausencia_rejeitada`, `novo_plantao`, `alteracao_escala`), e bootstrap real de Socket.IO (`backend/src/realtime/`, handshake autenticado, rooms `tenant:*`/`user:*`, eventos `message:send`/`message:new`/`notification:new`). `tenant-isolation.test.ts` estendido pra cobrir REST e socket. Verificado fim a fim contra o servidor real (sockets diretos, sem mock): mensagem chega ao vivo nos dois sentidos (gestor↔creator) e gatilho de notificação chega ao vivo no socket do destinatário.

- ✅ **Mensagens em tempo real**: `api/socket.ts` (renomeado `connectChat`→`connectRealtime`, uma conexão só pra chat+notificação) conectado de verdade ao Socket.IO (`VITE_SOCKET_URL`, handshake `{ auth: { token } }`). `Messages.tsx` ganhou o que faltava pra ser usável: `GET /messages/contacts` (novo — resolve quem dá pra contatar, já que `/conversations` só mostra quem já tem histórico) + seletor "nova conversa" (Modal desktop / MobileScreen mobile). Mensagem recebida ao vivo só entra na thread aberta se for dela; senão só recarrega a lista. Removido o "Online" decorativo (nunca existiu presença real).
- ✅ **Notificações**: popover real — `context/NotificationsContext.tsx` (lista + contador de não-lidas + assina `notification:new` ao vivo) consumido por `components/NotificationsList.tsx` (ícone por tipo, "Marcar lidas", empty state "Você está em dia ✦") nos 3 lugares que tinham o sino decorativo: `Topbar.tsx` (dropdown desktop), `AppLayout.tsx` e `Dashboard.tsx`/Início (tela cheia mobile, `MobileScreen`).

## Fase F5 — Bloqueado até o backend ter Anexos/Configurações (Fase 8, não implementada)

- [ ] **Anexos no chat** (`Messages.tsx`): upload de arquivo/imagem — o HTML de referência mostra o modal genérico já suportando isso ("Arraste uma imagem ou clique para enviar"). Pedido explícito da proposta original.
- [ ] **Configurações gerais** (área admin): tela/aba pra editar `company_settings` (nome, logo, timezone, locale) — fecha a permissão "Configurações gerais" do Admin, sem tela correspondente hoje.
- [ ] **Modal genérico**: padrão reutilizável de multi-select com tags, visto no HTML de referência — só vale generalizar quando houver uma 2ª tela que precise (anexos é a primeira).

## Fase F6 — Bloqueado até existir fluxo de reset de senha (não planejado em nenhuma fase ainda)

- [ ] **Login: "Esqueci a senha"** — presente no HTML de referência, mas não há endpoint de reset/convite em nenhuma fase do backend (mesmo gap já sinalizado em `specs/02` Fase 2: creators/collaborators criados hoje recebem senha que ninguém recebe). Resolver os dois junto quando chegar a hora.

## Trabalho adicional do app mobile (feito por pedidos diretos, fora da numeração F1-F6)

Depois da Fase F1, uma série de pedidos pontuais sobre a experiência mobile do `operacional` foram implementados fora da ordem das fases — registrado aqui pra não se perder:

- **PWA/fullscreen real**: `manifest.webmanifest` + `icon.svg` (reaproveita o logo do app) + meta tags iOS/Android em `index.html` (`apple-mobile-web-app-capable`, `theme-color`, `viewport-fit=cover`) — permite "Adicionar à Tela de Início" sem nenhuma UI do navegador. `100vh/100vw` → `100dvh/100dvw` em todas as telas full-screen (evita jank quando a barra de endereço do navegador mobile recolhe).
- **Moldura responsiva**: `.cp-phone-frame`/`.cp-fake-statusbar` em `theme.css` — acima de 480px (preview desktop) mantém a moldura de celular fake com barra de status decorativa; em 480px ou menos (celular de verdade) ocupa a tela toda, sem moldura nem barra de status duplicada (o SO já mostra a dele), com `env(safe-area-inset-*)` pro notch/barra de gestos.
- **Página de Perfil** (`screens/Profile.tsx`, rota `/perfil`): navegação por seta de voltar (padrão nativo), não modal — acessível pelo avatar da tela Início. Botão "Sair" também migrado pra dentro do `ProfileModal` do desktop.
- **Topbar das subpáginas mobile**: nome da página + sininho de notificação na mesma barra (`AppLayout.tsx`), igual ao padrão da tela Início — sininho real desde a Fase F4 (popover/tela cheia com `NotificationsList`, não mais decorativo).
- **Páginas de detalhe no mobile** (não previsto em nenhuma fase original): `MobileScreen` (tela cheia com seta de voltar, `position: absolute` ancorado no `.cp-phone-frame` — não `fixed`, senão escapa da moldura na preview desktop) + detalhe de tarefa/plantão/ausência/dia do cronograma, abertos a partir de Início/Cronograma/Plantões/Ausências.
- **Atualização em tempo real das telas de dados** (não só do sino/chat): `useRealtimeRefresh` (`context/NotificationsContext.tsx`) reaproveita os mesmos eventos `notification:new` pra recarregar Dashboard/Cronograma/Plantões/Ausências quando o gestor cria tarefa, muda status, cria plantão ou revisa ausência — sem isso essas telas só atualizavam recarregando a página manualmente.
- **Service Worker real** (`src/sw.ts`, `injectManifest` — não `generateSW`, porque precisa dos listeners de `push`/`notificationclick`): cache do app-shell + cache `NetworkFirst` de leitura da API (exclui `/auth` e `/socket.io`; chave de cache inclui o token, senão duas contas no mesmo navegador compartilhariam cache).
- **Push notification de ponta a ponta**: backend (`backend/src/realtime/pushSender.ts`, VAPID/`web-push`) reaproveita os mesmos 6 gatilhos de notificação já existentes — nenhuma lógica nova de "quem recebe o quê". Frontend: `PushToggle` (Perfil) + `PushPrompt` (banner na Início, com aviso específico pro iOS exigir "Adicionar à Tela de Início" antes da Push API existir no Safari).
- **HTTPS em dev** (`certs/`, mkcert, fora do git): Service Worker/Push exigem contexto seguro (`localhost` é a única exceção) — necessário pra testar em IP de LAN/celular. Documentado em `specs/09-deploy-vps.md` que isso é só workaround de dev; produção resolve de fábrica com domínio real + Let's Encrypt.
- **`MobileField`/`MOBILE_INPUT_STYLE`** (`components/MobileField.tsx`): padrão único de label/input maiores (16px nos inputs — evita o zoom automático do Safari iOS em campos <16px) usado por Perfil e "Solicitar ausência". Tamanhos gerais (ícones, footer, fontes) aumentados em todo o app mobile por pedido direto.
- **"Solicitar ausência" como tela cheia** (não modal): mesma seta de voltar do Perfil, em vez do `Modal` flutuante usado no resto do app.
- **Kanban removido de Tasks e Services** (decisão direta) — as duas telas ficaram só com Tabela/Cards/Timeline (Services não tinha Timeline antes; foi adicionada). `ViewToggle` (`components/ViewToggle.tsx`) ficou compartilhado entre as duas, com ícones + nome (não só ícone — testado e revertido por pedido).
- **`tasksApi`/`servicesApi` ganharam status editável no modal de edição** (não só drag-and-drop) — mesmo padrão `PUT` (sem status) + `PATCH .../status` (grava `status_history`) que `services` já usava.
- **`GET /tasks` agora traz `client_name`** via LEFT JOIN no backend — o card "Próximas tarefas" da Início mobile não tinha como mostrar o nome do cliente (operacional não tem acesso a `GET /clients`).

## Preparação para o app mobile (não construir agora)

- Nenhuma rota REST/Socket precisa mudar pra servir o mobile depois — o contrato já é desenhado pra ambos os clientes.
- O trabalho da Fase F1 (Absences com formulário de solicitação pra `operacional`) é, na prática, uma versão "provisória no web" do fluxo que a proposta desenhou pro mobile — continua valendo como fallback depois que o mobile existir.
