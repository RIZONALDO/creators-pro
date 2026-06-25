# 10 — Super Admin da Plataforma

> Spec da camada de gestão da própria plataforma CreatorsPro — separada do produto multi-tenant. O "sudo" do sistema: quem opera a plataforma, não quem usa como cliente.

---

## Contexto e motivação

Hoje toda gestão operacional (criar tenant, definir preço, configurar Stripe) exige acesso direto ao servidor via SSH ou ao painel do Stripe. Isso é insustentável a partir do momento em que a plataforma tem mais de 2–3 clientes ativos.

Esta spec descreve um **painel de administração da plataforma** (distinto do painel do `admin` de cada tenant) que permite:

1. Gerenciar tenants (listar, ativar, suspender, excluir)
2. Gerenciar planos (criar, editar preços, sincronizar com Stripe, criar plano vitalício)
3. Fazer backup por tenant e restaurar

---

## Decisão central: superadmin é separado do sistema de tenants

### Por quê não reutilizar o `role` de `admin`

O `admin` de um tenant é um usuário comum scoped por `tenant_id`. Se o superadmin fosse apenas um role especial na mesma tabela `users`, bastaria uma query sem filtro de tenant para vazar todos os dados da plataforma. O risco é estrutural, não de código.

**Decisão: tabela `superadmins` própria, middleware próprio, rotas `/platform/*` separadas.**

Nenhuma linha de código de autenticação de tenant é reutilizada aqui — é intencionalmente redundante.

---

## Modelo de dados

### Tabela `superadmins` (global, sem `tenant_id`)

```sql
CREATE TABLE superadmins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  totp_secret   TEXT,              -- 2FA TOTP (obrigatório na Fase 10b)
  created_at    TIMESTAMPTZ DEFAULT now()
);
```

Provisionada diretamente por migration seed — nunca via endpoint público. Não há "criar superadmin via UI": é uma decisão operacional consciente (precisa de acesso ao servidor para criar o primeiro).

### Tabela `plans` (global)

```sql
CREATE TABLE plans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,                  -- "Pro", "Starter", "Vitalício"
  stripe_product_id TEXT,                           -- null = plano sem Stripe (ex.: manual/vitalício)
  stripe_price_id   TEXT,                           -- null = plano one-time ou manual
  billing_type      TEXT NOT NULL                   -- 'monthly' | 'yearly' | 'one_time' | 'manual'
                    CHECK (billing_type IN ('monthly', 'yearly', 'one_time', 'manual')),
  price_cents       INTEGER NOT NULL,               -- preço em centavos (BRL)
  currency          TEXT NOT NULL DEFAULT 'brl',
  max_gestores      INTEGER,                        -- null = ilimitado
  max_creators      INTEGER,                        -- null = ilimitado
  active            BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
```

### Alteração em `companies`

```sql
ALTER TABLE companies ADD COLUMN plan_id UUID REFERENCES plans(id) ON DELETE SET NULL;
ALTER TABLE companies ADD COLUMN plan_override JSONB;
-- plan_override permite sobrescrever limites de um tenant específico sem criar um plano novo
-- ex.: {"max_gestores": 10, "max_creators": 50, "reason": "cliente VIP"}
```

---

## Autenticação do superadmin

### Fluxo de login

```
POST /platform/auth/login   { email, password }
```

1. `SELECT * FROM superadmins WHERE email = :email`
2. `bcrypt.compare` — falha → `401` (mensagem genérica)
3. Se `totp_secret` preenchido: retorna `{ next: 'totp' }` em vez do token — cliente envia `POST /platform/auth/totp { session_id, code }` para completar
4. Emite JWT com payload `{ sub: superadmin_id, scope: 'platform' }` — campo `scope` impossível de confundir com token de tenant
5. Access token: 2 horas (sessão mais longa que tenant, mas não ilimitada)
6. Sem refresh token — superadmin faz re-login; sessão longa demais é risco

### Middleware `authenticatePlatform`

```typescript
// middleware/authenticatePlatform.ts
export function authenticatePlatform(req, res, next) {
  // Lê Authorization: Bearer <token>
  // Decodifica JWT e verifica scope === 'platform'
  // NUNCA popula req.auth.tenantId — isso não existe no contexto de plataforma
  // Popula req.platformAdmin = { id, name, email }
}
```

**Isolamento garantido por design:** qualquer query de tenant usa `req.auth.tenantId` (que não existe aqui) — código de tenant nunca rodará sem um `tenantId` real, e código de plataforma nunca tem um.

---

## Rotas `/platform/*`

Todas autenticadas por `authenticatePlatform`. Nunca compartilham middleware com rotas de tenant.

### Gestão de tenants

```
GET    /platform/tenants                    # lista com filtro por status/plano
GET    /platform/tenants/:id                # detalhe + métricas de uso
PATCH  /platform/tenants/:id/status         # { status: 'active' | 'suspended' | 'cancelled' }
PATCH  /platform/tenants/:id/plan           # { plan_id, override? }
DELETE /platform/tenants/:id               # soft-delete (marca deleted_at) com jobs de limpeza
POST   /platform/tenants                    # criar tenant (substitui /internal/companies)
```

Métricas de uso em `GET /platform/tenants/:id`:
- Contagem de usuários, creators, tarefas, plantões
- Uso de storage (soma dos `file_size` em `attachments`)
- Data da última atividade (último login de qualquer usuário do tenant)
- Status da assinatura Stripe (se aplicável)

### Gestão de planos

```
GET    /platform/plans                      # lista todos os planos
POST   /platform/plans                      # criar plano (sincronia Stripe opcional)
PUT    /platform/plans/:id                  # editar metadados e/ou preço
PATCH  /platform/plans/:id/sync-stripe      # força re-sincronização com Stripe
DELETE /platform/plans/:id                  # só se nenhum tenant ativo usar o plano
```

#### Fluxo de criação de plano com Stripe

```
1. superadmin preenche formulário (nome, tipo, preço, limites)
2. API chama stripe.products.create + stripe.prices.create com a chave já configurada em env
3. Salva o plano em `plans` com os IDs do Stripe retornados
4. Responde com o plano criado (incluindo price_id para uso futuro no checkout)
```

**Chave Stripe nunca vai para o banco.** A chave de API fica em variável de ambiente no servidor (`STRIPE_SECRET_KEY`). A UI de planos trabalha com metadados (nome, preço, limites) — as chamadas à API do Stripe são feitas pelo backend com a chave já provisionada. Não existe campo "inserir chave da Stripe" na UI — isso é feito via `.env` no servidor, uma vez, pela equipe técnica.

#### Plano vitalício

O Stripe não tem conceito nativo de "plano vitalício". A implementação é:

```
billing_type = 'one_time'
stripe_product_id = <produto no Stripe>
stripe_price_id   = <price do tipo one_time no Stripe>
```

No webhook `checkout.session.completed` com `mode = 'payment'` (não `subscription`):
- Não gera `stripe_subscription_id`
- Seta `companies.plan_id = <plano_vitalicio_id>` e `companies.status = 'active'`
- `companies.lifetime = true` (nova coluna — esse tenant nunca é suspenso por billing)

O backend de suspensão (`customer.subscription.deleted`) ignora tenants onde `companies.lifetime = true`.

#### Edição de preço

Editar um preço no Stripe é irreversível (um price existente nunca muda — cria-se um novo). O fluxo:

```
1. superadmin edita o preço no formulário
2. API cria novo stripe.prices.create com o novo valor
3. Atualiza plans.stripe_price_id = novo price_id
4. O price antigo no Stripe fica arquivado (não deletado — assinaturas existentes continuam por ele até renovação)
5. Novos checkouts usam o novo price_id
```

Assinantes existentes continuam pagando o preço antigo até o próximo ciclo de renovação, quando o Stripe usa o novo price automaticamente (se configurado no portal do Stripe para migrar).

---

## Backup por tenant

### Estratégia

O banco é compartilhado (single DB, shared schema). Backup de um tenant = exportar todas as linhas com `tenant_id = :id` de todas as tabelas, mais os arquivos de storage associados.

### Endpoint

```
POST   /platform/tenants/:id/backup         # dispara job assíncrono de backup
GET    /platform/tenants/:id/backups        # lista backups disponíveis (data, tamanho, status)
GET    /platform/backups/:backup_id/download  # download do arquivo .zip
DELETE /platform/backups/:backup_id         # remover backup antigo
```

### O que o backup contém

```
backup_<tenant_id>_<timestamp>.zip
├── data/
│   ├── companies.json
│   ├── users.json
│   ├── creators.json
│   ├── collaborators.json
│   ├── clients.json
│   ├── creator_tasks.json
│   ├── collaborator_services.json
│   ├── absences.json
│   ├── shifts.json
│   ├── scale_months.json
│   ├── scale_entries.json
│   ├── messages.json
│   ├── attachments.json          # metadados (não o binário)
│   └── company_settings.json
├── files/
│   └── <uuid>_<filename>.<ext>  # binários dos anexos baixados do storage
└── manifest.json                # versão do schema, data do backup, contagem de linhas
```

### Restore

O restore é **manual com script**, não via UI na Fase 10a. O superadmin baixa o `.zip`, roda:

```bash
node scripts/restore-tenant.js backup_<id>_<ts>.zip --target-db=<DATABASE_URL>
```

O script:
1. Valida o `manifest.json` contra a versão atual do schema
2. Cria a company com novo ID (para não colidir) ou sobrescreve se `--overwrite`
3. Insere os dados na ordem correta (respeita FK: companies → users → creators → ...)
4. Sobe os arquivos de volta ao storage
5. Reporta quantas linhas inseridas por tabela

Restore via UI (clicar um botão) fica para a Fase 10b — o risco de sobrescrever dados de produção via UI sem um flow de confirmação robusto é alto.

### Tabela de controle dos backups

```sql
CREATE TABLE platform_backups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'running', 'done', 'failed')),
  file_url      TEXT,               -- URL no storage após concluir
  file_size_kb  INTEGER,
  error         TEXT,
  created_by    UUID REFERENCES superadmins(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  completed_at  TIMESTAMPTZ
);
```

---

## Frontend: painel `/platform/*`

### Isolamento de rota

O painel de plataforma é uma aplicação React separada **dentro do mesmo repo**, em `frontend/src/platform/`. Nunca compartilha contexto de autenticação (`AppContext`) com o produto.

```
frontend/src/
├── App.tsx                    # produto (tenants)
├── platform/
│   ├── PlatformApp.tsx        # root do painel de plataforma
│   ├── PlatformLogin.tsx
│   ├── screens/
│   │   ├── Tenants.tsx
│   │   ├── TenantDetail.tsx
│   │   ├── Plans.tsx
│   │   └── Backups.tsx
│   └── context/
│       └── PlatformContext.tsx
```

Montado em `main.tsx` pela URL: se `window.location.pathname.startsWith('/platform')` → `<PlatformApp />`, senão → `<App />`. Não há React Router aninhado entre os dois — são árvores completamente separadas.

### Telas

**Login do superadmin** (`/platform/login`)
- Formulário e-mail + senha
- Se TOTP ativo: segundo passo com campo de código de 6 dígitos

**Lista de tenants** (`/platform/tenants`)
- Tabela com: nome, plano, status, criado em, último acesso, nº de usuários/creators/tarefas
- Filtro por status e plano
- Botões: Suspender, Reativar, Ver detalhe

**Detalhe do tenant** (`/platform/tenants/:id`)
- Métricas de uso
- Histórico de status
- Trocar plano (dropdown de planos ativos)
- Override de limites (formulário `{ max_gestores, max_creators, reason }`)
- Disparar backup

**Gestão de planos** (`/platform/plans`)
- Lista de planos com preço, tipo, nº de tenants usando
- Criar plano: formulário com tipo (mensal/anual/único/manual), preço, limites, sincronizar com Stripe
- Editar plano: mesmo formulário — alerta explicando que editar preço cria novo price no Stripe
- Plano vitalício: tipo `one_time`, checkbox "Vitalício — nunca suspender por billing"

**Backups** (`/platform/backups`)
- Tabela de backups (todos os tenants) com: tenant, data, tamanho, status
- Filtrar por tenant
- Botão "Baixar .zip" para backups concluídos

---

## Fases de implementação

### Fase 10a — Fundação (superadmin auth + tenant management)
- Tabela `superadmins` + seed do primeiro superadmin
- Middleware `authenticatePlatform`
- Rotas `/platform/auth/*` + `/platform/tenants`
- Frontend: Login + Lista de tenants + Detalhe básico
- **Critério de saída**: superadmin consegue logar, ver todos os tenants e suspender/reativar um

### Fase 10b — Planos & Stripe
- Tabela `plans` + coluna `plan_id`/`lifetime` em `companies`
- Rotas `/platform/plans` com sincronização Stripe
- Plano vitalício via `checkout.session.completed` com `mode = 'payment'`
- Frontend: tela de planos com criar/editar/sincronizar
- 2FA TOTP para superadmin
- **Critério de saída**: criar plano via UI cria produto+preço no Stripe; checkout de tenant usa o novo preço

### Fase 10c — Backup por tenant
- Tabela `platform_backups`
- Job de backup (export JSON por tabela + download de arquivos do storage)
- Script de restore (`scripts/restore-tenant.js`)
- Frontend: tela de backups com disparar e baixar
- **Critério de saída**: backup de um tenant real baixado, restore executado em banco de staging sem erros

---

## O que explicitamente fica fora desta spec

- **Restore via UI** (Fase 10c implementa só o download; restore fica no script CLI)
- **Multi-moeda** (o plano de preços é BRL por enquanto)
- **White-label por tenant** (subdomínio próprio, logo customizado) — produto diferente
- **Marketplace de planos self-service** (tenant escolhe plano na tela) — hoje o plano é atribuído pelo superadmin; autoatendimento pode vir depois
