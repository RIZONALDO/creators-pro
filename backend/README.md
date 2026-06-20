# CreatorsPro API (backend)

Implementa as Fases 0 e 1 de `specs/07-roadmap-implementacao.md`: setup do projeto + tenancy/auth multi-tenant. Ver `specs/` na raiz do monorepo para o desenho completo (modelo de dados, contrato de API, regras de negócio, roadmap).

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

## O que falta para a Fase 2

- Tabelas/módulos de `creators`, `collaborators`, `clients` (ver `specs/02-modelo-de-dados.md` e `specs/07-roadmap-implementacao.md#fase-2`).
- Estender `src/test/tenant-isolation.test.ts` com os novos recursos.
- Nenhuma mudança é esperada na Fase 1 entregue aqui — `companies`, `users`, `refresh_tokens` e as rotas `/auth/*` + `/internal/companies` já estão completas e testadas.
