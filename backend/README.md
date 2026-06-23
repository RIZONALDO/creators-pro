# CreatorsPro API (backend)

Implementa as Fases 0 a 5 + 4b de `specs/07-roadmap-implementacao.md`: setup do projeto, tenancy/auth multi-tenant, catálogos, tarefas/serviços com histórico de status, escala de creators + feriados, ausências/plantões, e a validação cruzada Escala↔Ausências que faltava (Fase 4b, fechada agora que a Fase 5 existe). Ver `specs/` na raiz do monorepo para o desenho completo (modelo de dados, contrato de API, regras de negócio, roadmap).

## Banco de dados local (sem Docker)

Esta máquina não tem Docker — usamos o PostgreSQL 14 (Homebrew) que já roda em `localhost:5432`, com dois bancos dedicados:

```bash
psql -U rssl -h localhost -d postgres -c "CREATE DATABASE creatorspro_dev OWNER rssl;"
psql -U rssl -h localhost -d postgres -c "CREATE DATABASE creatorspro_test OWNER rssl;"
```

(Já criados nesta máquina. Se for configurar em outra máquina/role, ajuste `DATABASE_URL` nos `.env`/`.env.test` de acordo.)

No futuro, avaliar `docker-compose.yml` para portabilidade entre máquinas — não é necessário agora.

## Setup

```bash
cd backend
npm install
cp .env.example .env        # ajuste DATABASE_URL/segredos
cp .env.example .env.test   # aponte DATABASE_URL pro banco creatorspro_test

npm run db:migrate            # aplica migrations em creatorspro_dev (lê .env)
npm run db:migrate:test       # aplica migrations em creatorspro_test (lê .env.test)
npm run db:seed               # popula creatorspro_dev com tenant + usuários demo

npm test                      # roda toda a suíte (Vitest) contra creatorspro_test
npm run dev                   # sobe a API em http://localhost:3001
```

## Credenciais de demonstração (seed, `npm run db:seed`)

Tenant **Studio Norte** (`slug: studio-norte`), mesmas contas do mock do frontend:

| E-mail | Papel | Senha |
|---|---|---|
| `fernanda@studionorte.com` | `gestor` | `demo1234` |
| `carlos@studionorte.com` | `admin` | `demo1234` |

Senha de demonstração local — não é segredo de produção, não usar fora de dev local.

## Decisões tomadas nesta fase (sem pausar pra perguntar, conforme pedido)

- **bcryptjs** em vez de `bcrypt` nativo — evita dependência de compilação nativa (node-gyp) pra rodar localmente; mesma API, mesmo algoritmo.
- **Refresh token**: string opaca aleatória (32 bytes), guardado como hash SHA-256 (não bcrypt — precisamos de lookup determinístico por igualdade no banco; bcrypt é proposital-mente não determinístico, serve para senha, não para token indexável).
- **Rotação de refresh token**: cada `POST /auth/refresh` revoga o token usado e emite um novo — token antigo nunca é reutilizável (mitigação de replay).
- **`/internal/companies`**: autenticado por header `x-platform-secret` (comparado a `PLATFORM_PROVISION_SECRET`), não por JWT de usuário — não há tenant ainda nesse momento.
- **Banco de teste separado** (`creatorspro_test`) carregado via `.env.test`, isolado do banco de dev — `src/test/setup.ts` garante que os testes nunca leem `.env` de produção/dev por acidente.
- **Vitest com `fileParallelism: false`**: todos os arquivos de teste batem no mesmo Postgres de teste; rodar em paralelo causaria corrida entre `TRUNCATE` de um arquivo e inserts de outro.

## Decisões tomadas na Fase 2

- **`POST /creators` e `POST /collaborators` exigem `email` não-nulo**, mesmo o tipo `NewCreator`/`NewCollaborator` do frontend permitir `email: null` — `users.email` é `NOT NULL UNIQUE` (é o identificador de login), então não dá pra criar a conta sem ele. Ajuste de formulário fica para a Fase 8 do roadmap (`specs/08-ajustes-frontend.md`).
- **Sem fluxo de convite/reset de senha ainda**: ao criar um creator/collaborator, o backend gera uma senha temporária aleatória só pra satisfazer a constraint `NOT NULL` de `password_hash` — ninguém a recebe, e a pessoa não consegue logar até existir um fluxo de convite/"esqueci minha senha" (fora do escopo da Fase 2; precisa ser adicionado num momento que ainda não foi planejado nos specs — sinalizar antes de avançar para o app mobile/operacional).
- **Envelope de paginação `{ data, meta }`** introduzido agora (primeiros endpoints de listagem do projeto) — `GET /creators`, `/collaborators`, `/clients` aceitam `?page=&pageSize=` (default 50, máx 200).
- **RBAC**: `creators`/`collaborators`/`clients`/`professions` são `admin`+`gestor` apenas — `operacional` recebe `403` em tudo, inclusive leitura (confirmado por teste).
- **`employment_type` é um enum Postgres compartilhado** (`src/db/schema/enums.ts`) entre `creators` e `collaborators` — evita declarar o mesmo tipo duas vezes no banco.
- **`profession` continua sem tabela própria** — `/professions` combina uma lista default (igual ao mock do frontend) com os valores distintos já usados em `collaborators.profession` do tenant; `POST /professions` não persiste nada, só ecoa (ver `specs/04-contrato-api.md`).

## Decisões tomadas na Fase 3

- **`status_history` é polimórfica** (`entity_type` + `entity_id`) e única para `task`/`service` (e futuramente `absence`/`shift`) — mesma tabela, sem repetir a estrutura 4 vezes (ver `specs/02-modelo-de-dados.md`).
- **`PUT /tasks/:id` e `PUT /services/:id` não aceitam `status`** — toda mudança de status passa exclusivamente por `PATCH .../status`, garantindo que `status_history` nunca fique sem registro de uma transição.
- **`creator_id`/`client_id`/`collaborator_id` são validados contra o tenant antes do insert** (não só pela FK do banco) — retornam `400 INVALID_CREATOR`/`INVALID_CLIENT`/`INVALID_COLLABORATOR` em vez de deixar a constraint do Postgres estourar como erro 500 cru; isso também impede adivinhar IDs de outro tenant.
- **`GET /tasks` e `GET /services` são liberados para `operacional`** (diferente de `creators`/`collaborators`/`clients`, que são `admin`/`gestor` only) — mas o filtro "só o que é meu" é resolvido no service a partir do `creator_id`/`collaborator_id` vinculado ao `user_id` do token, nunca por parâmetro vindo do client. Usuário operacional sem creator/collaborator vinculado recebe lista vazia, não erro.
- **`PATCH /status` exige `admin`/`gestor`** — operacional só visualiza, nunca muda status (confirmado por teste, RBAC já documentado em `specs/03`).
- **`GET /status-history?entity_type=&entity_id=`** alimenta qualquer tela de "Histórico" futura (ex.: Plantões na Fase 5) com a mesma rota, sem endpoint dedicado por entidade.

## Decisões tomadas na Fase 4a

- **`is_holiday` nunca é confiado do que está gravado em `scale_entries`** — toda leitura (`GET /scale-entries`) recalcula cruzando com `holidays` na hora, então cadastrar um feriado depois já reflete em entradas existentes (testado).
- **`GET /scale-entries?month=` preenche automaticamente 1 linha por dia útil do mês** (cria as que faltarem, `creator_id: null`) — o frontend sempre recebe a grade completa do mês, nunca precisa lidar com "dias sem linha".
- **Upsert por `(tenant_id, work_date)`** via `ON CONFLICT DO UPDATE` (`scaleEntries.upsertAssignment`) — usado tanto pela atribuição manual quanto pela escala automática e pela duplicação de mês; não existe caminho de código que insira duas linhas pro mesmo dia.
- **Escala automática (round-robin) pula feriado e fim de semana**, mas **ainda não pula ausência aprovada** — `absences` não existe até a Fase 5; isso é exatamente a Fase 4b.
- **Duplicar mês preserva o número do dia**, não o dia da semana (ex.: dia 2 de junho → dia 2 de julho) — pula silenciosamente se o dia não existir no mês de destino (ex. dia 31) ou se cair em fim de semana/feriado lá.
- **Feriados móveis (Carnaval, Sexta-feira Santa, Corpus Christi) não estão no seed** — dependem do cálculo da Páscoa, que não foi implementado para evitar seedar uma data errada sem verificação. Seed cobre só os 9 feriados nacionais de data fixa de 2026. Cadastrar os móveis manualmente via `POST /holidays` enquanto isso não for resolvido.
- **`GET /scale-entries` e `GET /holidays` são liberados para `operacional`** (só leitura) — mesma lógica de `tasks`/`services`: ele precisa ver a escala do mês, só não pode editar.

## Decisões tomadas na Fase 5

- **`POST /absences` não tem `authorize()` de papel** — a regra "só pode solicitar para si mesmo" é do `operacional` e é resolvida dentro do `absences.service.ts`, não no middleware de rota: `admin`/`gestor` podem registrar uma ausência em nome de qualquer creator do tenant (ex.: avisou por telefone), `operacional` só pode informar o próprio `creator_id` vinculado (`403 CANNOT_REQUEST_FOR_OTHER_CREATOR` se tentar outro).
- **`PATCH /absences/:id/review` é `admin`/`gestor` only** e grava `approved_by`/`approved_at` + `status_history` (`entity_type='absence'`) na mesma transação.
- **`PUT /shifts/:id` também não aceita `status`** — mesma regra de tasks/services, toda mudança de status passa por `PATCH /shifts/:id/status` (endpoint novo, não estava no contrato original de `specs/04`, adicionado por consistência).
- **Plantões (`shifts`) usam o mesmo padrão de filtro "só o que é meu" de tasks/services**, resolvido via `creator_id` vinculado ao token — consistente com a regra de negócio original ("plantões são só de creators").
- **`absences.findApprovedOverlapping(tenantId, creatorId, date)`** foi escrito já nesta fase (não na 4b) porque é puramente uma consulta do módulo de ausências — a Fase 4b só precisou *chamá-la* do `schedule.service.ts`.

## Decisões tomadas na Fase 4b

- **`PUT /scale-entries/:work_date`** agora retorna **`409 ABSENCE_OVERLAPS_SCHEDULE`** se o creator informado tiver uma ausência **aprovada** cobrindo a data (ausência `pending`/`rejected` não bloqueia).
- **`POST /scale-months/:id/auto-assign`** pula, dia a dia, qualquer creator com ausência aprovada **nessa data específica** (não no mês todo) — o ponteiro do round-robin só avança quando alguém é de fato escalado; se todos estiverem indisponíveis num dia, ele fica com `creator_id: null` em vez de forçar alguém ausente.
- **`POST /scale-months/:id/duplicate`** também não copia a atribuição se o creator tiver ausência aprovada na **data de destino** (mesma regra, evita reabrir a mesma inconsistência por outro caminho de código) — isso não estava explícito no roadmap original, mas é a mesma regra de negócio aplicada ao terceiro lugar que faz `upsertAssignment` direto.
- **Notificação `alteracao_escala` está deferida para a Fase 6** (`notifications` ainda não existe) — há um `TODO` explícito em `schedule.service.ts` apontando para `specs/06-regras-de-negocio.md`; não esquecer ao implementar a Fase 6.

## Ajuste fora do roadmap: plugando o frontend real (antes da Fase 6)

Ao trocar `VITE_USE_MOCK=false` no frontend pra testar de verdade, apareceram 3 gaps que nenhuma fase anterior cobria — todos corrigidos agora:

- **Faltava o módulo `/users`** — estava documentado em `specs/04-contrato-api.md` desde o início, mas nunca foi atribuído a uma fase do roadmap (descuido meu). Implementado agora: `GET/POST /users` + `PUT /users/:id`, `admin` only, reaproveitando `auth/users.repository.ts` (`listByTenant`/`findByIdInTenant`/`updateAdmin`, todos tenant-scoped) e um `sanitizeUser` compartilhado (antes duplicado dentro de `auth.service.ts`).
- **Bug real de casing, achado só ao testar no browser de verdade** (`Shifts.tsx` quebrou com `Cannot read properties of undefined (reading 'split')`): o Drizzle nomeia objetos JS em camelCase (`shiftDate`, `tenantId`...), e isso vazava direto pro `res.json()` sem conversão — mas o resto do contrato (specs/02, specs/04, o schema SQL original, e os próprios esquemas Zod de entrada) sempre foi `snake_case`. Corrigido com um middleware global (`middleware/snakeCaseResponse.ts` + `lib/caseConvert.ts`) que converte toda resposta — sem precisar tocar rota por rota. Os ~15 testes de integração que checavam `res.body.campoEmCamelCase` foram corrigidos pra `snake_case` (eram a única coisa que escondia o bug; testes de repository não passam pelo middleware e por isso nunca o pegariam).
- **Mesma inconsistência no campo `refreshToken`** de `/auth/refresh` e `/auth/logout` — era a única rota com body em camelCase (erro meu desde a Fase 1, `specs/03` documentava assim). Corrigido pra `refresh_token`, specs atualizados.

**Por que o middleware global e não converter campo-por-campo**: qualquer rota nova (Fase 6+) já nasce correta automaticamente — não tem como esquecer de converter uma resposta nova.

## O que falta para a Fase 6

- Tabelas/módulos de `messages` e `notifications` + bootstrap do Socket.IO — ver `specs/05-realtime-socketio.md` e `specs/07-roadmap-implementacao.md#fase-6--mensagens--notificações--socketio`.
- Fechar o `TODO` de notificação `alteracao_escala` deixado na Fase 4b (`schedule.service.ts`, função `autoAssign`/`assign`).
- Resolver o gap de convite/senha de creators/collaborators (sinalizado na Fase 2) antes de qualquer fluxo de login real para `operacional` (mobile ou web).
