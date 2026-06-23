# 03 — Autenticação, Multi-tenancy e Permissões (RBAC)

## Fluxo de login

```
POST /auth/login   { email, password }
```

1. `SELECT * FROM users WHERE email = :email` (sem filtro de tenant — e-mail é único globalmente, ver [01](./01-arquitetura-geral.md)).
2. Se não existir ou `status != 'active'` → `401`.
3. `bcrypt.compare(password, password_hash)`. Falha → `401` (mensagem genérica, não revelar se o e-mail existe).
4. Gera **access token** (JWT, 15 min de validade) com payload:
   ```json
   { "sub": "<user_id>", "tenant_id": "<tenant_id>", "role": "admin|gestor|operacional", "iat": ..., "exp": ... }
   ```
5. Gera **refresh token** (string aleatória opaca, 30 dias), guarda só o hash em `refresh_tokens` (ver [02](./02-modelo-de-dados.md#refresh_tokens-novo--fix-8)).
6. Responde `{ token, refresh_token, user }` — formato compatível com o `AuthSession` já existente em `frontend/src/types.ts` (só adiciona `refresh_token`).

```
POST /auth/refresh   { refresh_token }
```
Valida hash contra `refresh_tokens` (não revogado, não expirado) → emite novo access token. Rotação opcional do refresh token (recomendado: rotacionar a cada uso, revogando o anterior).

```
POST /auth/logout
```
Marca o refresh token atual como `revoked_at = now()`. Sem isso hoje, "logout" só descarta o token no client — o token antigo continuaria válido até expirar.

```
GET /auth/me
```
Decodifica o access token, retorna o `User` atual (já existe, sem mudança de contrato).

## Middleware de autenticação (toda rota protegida)

```
authenticate → authorize(role?) → handler
```

- `authenticate`: valida o JWT, popula `req.auth = { userId, tenantId, role }`. Token inválido/expirado → `401`.
- `authorize(...roles)`: se a rota exigir um papel específico (ex.: `authorize('admin')` em `/users`), compara com `req.auth.role` → `403` se não bater.
- **Toda query do repository usa `req.auth.tenantId`** — nunca um `tenant_id` vindo de query param/body. Isso é o que de fato impede vazamento de dado entre empresas, não só o middleware de role.

## Provisionamento de tenant

Não há signup self-service (fora de escopo da proposta original). Uma nova empresa é criada por um script/endpoint interno:

```
POST /internal/companies   (protegido por header de secret de plataforma, não por JWT de usuário)
{ name, slug, adminName, adminEmail, adminPassword }
```

Cria `companies` + `company_settings` (linha default) + o primeiro `users` com `role = 'admin'` numa transação. Esse endpoint **nunca** é exposto no frontend do produto — é uma ferramenta interna da equipe CreatorsPro para onboarding de clientes novos.

## Matriz de permissões (RBAC)

Hoje o frontend dá acesso idêntico a `gestor` e `operacional` (nenhuma tela checa `role`). Isso é uma lacuna de produto, não só de UI — a proposta original é explícita: operacional só visualiza. O backend **aplica isso de verdade**, independente do que o frontend reforça ou não (defesa em profundidade — ver também [08-ajustes-frontend.md](./08-ajustes-frontend.md) para o que muda na UI).

| Recurso | admin | gestor (coordenador) | operacional |
|---|---|---|---|
| `users` (CRUD) | ✅ total | ❌ | ❌ |
| `company_settings` | ✅ total | ❌ leitura | ❌ |
| `clients` (CRUD) | ✅ | ✅ | ❌ (sem leitura — não precisa saber cliente fora do que vê na própria tarefa) |
| `creators` / `collaborators` (CRUD) | ✅ | ✅ | ❌ (cadastro próprio é feito pelo admin/gestor) |
| `creator_tasks` — listar/ver | ✅ todas | ✅ todas | ✅ **somente as suas** (`creator_id` = creator vinculado ao próprio `user_id`) |
| `creator_tasks` — criar/editar/mudar status | ✅ | ✅ | ❌ |
| `collaborator_services` — listar/ver | ✅ todas | ✅ todas | ✅ **somente os seus** |
| `collaborator_services` — criar/editar | ✅ | ✅ | ❌ |
| `scale_entries` — ver | ✅ | ✅ | ✅ (somente leitura, a escala completa do mês — precisa ver quem está escalado) |
| `scale_entries` — atribuir/escala automática/duplicar mês | ✅ | ✅ | ❌ |
| `absences` — listar todas / aprovar / rejeitar | ✅ | ✅ | ❌ |
| `absences` — solicitar (criar a própria) | ✅* | ✅* | ✅ **apenas para o próprio `creator_id`** |
| `absences` — ver as próprias | ✅ | ✅ | ✅ |
| `shifts` — listar/criar/designar | ✅ | ✅ | ❌ |
| `shifts` — ver os próprios | ✅ | ✅ | ✅ |
| `messages` — enviar/ler | ✅ | ✅ | ✅ (apenas conversas em que é participante) |
| `notifications` — ver as próprias / marcar lida | ✅ | ✅ | ✅ |
| `reports` — leitura | ✅ | ✅ | ✅ **somente o que é "visualizar relatórios" da proposta** — escopo a decidir entre (a) relatórios agregados da empresa toda, somente leitura, ou (b) relatórios da própria produção. Recomendação: começar com (b), expandir pra (a) se o cliente pedir. |
| `holidays` — ver | ✅ | ✅ | ✅ |
| `holidays` — criar/editar | ✅ | ✅ | ❌ |

\* Admin/gestor normalmente não solicitam ausência (não são creators), mas a rota não bloqueia — só faz sentido se o usuário tiver um `creator_id` vinculado.

### Por que aplicar isso no backend mesmo sem mexer no frontend ainda

Mesmo que o ajuste de UI (esconder botões para `operacional`) só aconteça na fase de frontend ([08-ajustes-frontend.md](./08-ajustes-frontend.md)), o backend **já nasce** bloqueando essas ações via `403`. Isso evita o cenário onde alguém inspeciona a rede e chama `PUT /tasks/:id` direto, ou onde o app mobile futuro (que vai logar como `operacional`) ganha acidentalmente poder de escrita que a proposta nunca previu.
