# Deploy — CreatorsPro

Este documento explica como o CreatorsPro está hospedado em produção e qual o fluxo pra publicar
qualquer mudança nova. Se você é um(a) dev novo(a) no projeto, isso aqui é o suficiente pra fazer
deploy sozinho(a), sem precisar perguntar nada a mais.

## Visão geral

- **URL de produção**: https://creatorspro.nagibproducoes.com.br
- **VPS**: compartilhada com outros apps da Nagib Produções (JobPro, Proteam, etc.) — não é uma
  máquina dedicada só ao CreatorsPro.
- **Repositório**: monorepo (`backend/` + `frontend/` no mesmo repo Git) — `https://github.com/RIZONALDO/creators-pro`
  (privado).
- **Branch de produção**: `main`. A VPS sempre faz `git pull` direto dessa branch — não existe
  branch de staging nem CI automatizado ainda; o controle de "está pronto pra ir pro ar" é humano
  (revisar antes de fazer merge/push em `main`).

### Como as peças se encaixam na VPS

```
/var/www/creatorspro/           <- clone do repositório Git (código-fonte)
  ├── backend/
  │   ├── .env                  <- segredos de produção (NUNCA committed — está no .gitignore)
  │   ├── dist/                 <- gerado pelo build (tsc), é o que o pm2 de fato executa
  │   └── ecosystem.config.cjs  <- config do pm2 (script + cwd, SEM segredo nenhum aqui)
  └── frontend/
      ├── .env                  <- variáveis de build do Vite (também não é committed)
      └── dist/                 <- gerado pelo build (vite build), é copiado pra fora daqui

/var/www/creatorspro-public/    <- cópia do frontend/dist — é o que o nginx serve como arquivo estático
```

O backend roda como processo Node gerenciado pelo **pm2** (nome do processo: `creatorspro-api`),
escutando numa porta interna (`8088`, definida em `backend/.env` via `PORT`) que **não é exposta
direto à internet** — só o nginx, na porta 443 (HTTPS), conversa com ela.

### Como o nginx decide o que é API e o que é o app (frontend)

Diferente de outros apps desse VPS (ex.: JobPro, que usa prefixo `/api/`), as rotas do backend do
CreatorsPro não têm prefixo — ficam direto na raiz (`/auth`, `/tasks`, `/creators`, etc., ver
`specs/04-contrato-api.md`). Por isso o nginx (`/etc/nginx/sites-available/creatorspro` na VPS)
identifica a API por uma **lista explícita de prefixos**:

```
auth billing signup internal users creators collaborators clients professions status-history
tasks services scale-entries scale-months holidays absences shifts messages conversations
notifications push reports attachments company account
```

Qualquer requisição pra um desses prefixos (e `/socket.io/`) vai pro backend (`localhost:8088`);
tudo o mais cai no `try_files ... /index.html` (SPA do React) servido estaticamente de
`/var/www/creatorspro-public`.

**Se você criar uma rota nova no backend com um prefixo que não está nessa lista, ela vai cair no
SPA fallback e devolver o HTML do front em vez de chegar na API.** Nesse caso, edite o bloco
`location ~ ^/(...)` desse arquivo na VPS, adicione o novo prefixo, e rode `nginx -t && systemctl
reload nginx`. (Isso é o único ponto de atenção real de manutenção desse esquema — o trade-off de
não ter usado um subdomínio próprio pra API, que teria zero manutenção nesse sentido.)

## Acesso necessário

Pra fazer qualquer coisa abaixo, você precisa de:

1. **Acesso de escrita ao repositório no GitHub** (`RIZONALDO/creators-pro`) — peça pra ser
   adicionado como colaborador.
2. **Acesso SSH à VPS** (IP, porta, usuário `root`, senha) — **não está neste documento de
   propósito** (é segredo de produção, nunca deve ir pro Git). Peça a quem já tem acesso (consulte
   o gerenciador de senhas da equipe).

Você **não precisa** de nenhuma chave SSH própria pra fazer deploy — só pra entrar na VPS via senha
e rodar os comandos de lá. A chave SSH que a VPS usa pra puxar do GitHub é separada da sua (ver
seção seguinte).

## A questão da chave SSH (deploy key) — por que existe e como funciona

O repositório é **privado**. Pra VPS conseguir fazer `git pull` sem expor o token de acesso pessoal
de ninguém (e sem dar acesso de escrita ao repo pra uma máquina que só precisa ler), criamos uma
**Deploy Key**: um par de chaves SSH só pra essa finalidade, com permissão **somente leitura**,
cadastrada direto no repositório (não numa conta de usuário do GitHub).

Isso já está configurado e funcionando — você não precisa refazer nada pra continuar o projeto. Mas
se um dia a VPS for recriada (nova máquina, mesmo repositório), aqui está o passo a passo completo:

```bash
# 1. Na VPS, gera um par de chaves novo, só pra essa finalidade
ssh-keygen -t ed25519 -f ~/.ssh/creatorspro_deploy_key -N '' -C 'creatorspro-deploy@vps'

# 2. Mostra a chave pública pra copiar
cat ~/.ssh/creatorspro_deploy_key.pub

# 3. No GitHub: Settings do repositório -> Deploy keys -> Add deploy key
#    Cola a chave, título qualquer, NÃO marca "Allow write access" (só leitura)

# 4. Na VPS, confia no host github.com (primeira conexão) e configura o SSH pra usar essa chave
#    especificamente pra github.com (sem isso, o ssh tenta a chave padrão e falha):
ssh-keyscan -t ed25519 github.com >> ~/.ssh/known_hosts

cat >> ~/.ssh/config << 'EOF'
Host github.com
  IdentityFile ~/.ssh/creatorspro_deploy_key
  IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config

# 5. Testa
ssh -T git@github.com   # deve responder "Hi RIZONALDO! You've successfully authenticated..."

# 6. Clona usando a URL SSH (não HTTPS)
git clone git@github.com:RIZONALDO/creators-pro.git /var/www/creatorspro
```

Depois disso, todo `git pull` dentro de `/var/www/creatorspro` já usa essa chave automaticamente —
não precisa passar token nem senha em nenhum momento.

## O fluxo de deploy, passo a passo

### 1. Editar local

Trabalhe normalmente no seu clone local (`backend/` e/ou `frontend/`). Rode os testes/`tsc` antes
de seguir:

```bash
cd backend && npm test && npm run lint   # lint = tsc --noEmit
cd ../frontend && npm run lint && npm run build
```

### 2. Commit + push

```bash
git add <arquivos>
git commit -m "mensagem clara do que mudou e por quê"
git push origin main
```

Não existe revisão automática (CI) nem branch de staging hoje — quem dá `push` em `main` está, na
prática, autorizando que aquilo vá pra produção no próximo deploy.

### 3. Entrar na VPS e rodar o deploy

```bash
ssh -p 22022 root@<IP-DA-VPS>     # peça o IP/senha a quem já tem acesso
cd /var/www/creatorspro
bash deploy.sh
```

### O que `deploy.sh` faz, exatamente

```bash
cd /var/www/creatorspro
git pull origin main          # traz o código novo

cd backend
npm install                   # instala dependência nova, se houver
npm run db:migrate            # aplica migração de banco pendente (Drizzle)
npm run build                 # compila TypeScript -> dist/

cd ../frontend
npm install
npm run build                 # gera dist/ (build de produção, lê frontend/.env)
rsync -a --delete dist/ /var/www/creatorspro-public/   # publica os arquivos estáticos

pm2 restart creatorspro-api --update-env   # reinicia o backend com o código novo
```

`set -e` no topo do script: se qualquer passo falhar (ex.: `tsc` com erro, migração que dá erro),
o script para imediatamente — não tem deploy parcial silencioso.

### 4. Confirmar que subiu

```bash
pm2 logs creatorspro-api --lines 30   # confirma que iniciou sem Error
curl -I https://creatorspro.nagibproducoes.com.br/
```

## Variáveis de ambiente (produção)

Os arquivos `.env` reais **vivem só na VPS** (`/var/www/creatorspro/backend/.env` e
`/var/www/creatorspro/frontend/.env`), nunca no Git. Use `backend/.env.example` e
`frontend/.env.example` (esses sim estão no repositório) como referência de quais chaves existem e
o que cada uma significa.

Pendência conhecida: `GOOGLE_CLIENT_ID` ainda está em branco nos dois `.env` de produção — o login
com Google não funciona até alguém (1) adicionar `https://creatorspro.nagibproducoes.com.br` como
origem autorizada no Google Cloud Console (mesmo Client ID já usado em desenvolvimento) e (2)
preencher esse valor nos dois arquivos `.env` da VPS, e rodar `bash deploy.sh` de novo (ou só
`pm2 restart creatorspro-api --update-env` + rebuild do frontend, já que o frontend lê essa
variável em tempo de build, não de runtime).

## Provisionamento do zero (só se a VPS for recriada)

Isso já foi feito uma vez nesta VPS — não precisa repetir pra deploys normais. Documentado aqui só
pra não depender de ninguém lembrar de cabeça se um dia for preciso montar tudo de novo numa
máquina nova:

1. Clonar o repositório (ver seção da deploy key acima).
2. Criar banco e usuário Postgres dedicados:
   ```sql
   CREATE USER creatorspro WITH PASSWORD '<senha forte gerada na hora>';
   CREATE DATABASE creatorspro_prod OWNER creatorspro;
   ```
3. Criar `backend/.env` e `frontend/.env` na VPS (copiar a estrutura dos `.env.example`, gerar
   segredos novos — `openssl rand -hex 32` pra JWT_SECRET/JWT_REFRESH_SECRET/
   PLATFORM_PROVISION_SECRET, `npx web-push generate-vapid-keys` pras chaves VAPID).
4. `npm install` em `backend/` e `frontend/`.
5. `npm run db:migrate` (backend).
6. `npm run build` nos dois.
7. `mkdir -p /var/www/creatorspro-public && rsync -a frontend/dist/ /var/www/creatorspro-public/`.
8. `pm2 start backend/ecosystem.config.cjs && pm2 save`.
9. Criar `/etc/nginx/sites-available/creatorspro` (copiar o bloco de outro app do VPS como
   referência de estrutura, ajustando os prefixos de rota — ver seção acima) e
   `ln -s` em `sites-enabled`.
10. `nginx -t && systemctl reload nginx`.
11. `certbot --nginx -d creatorspro.nagibproducoes.com.br` — emite e configura HTTPS automaticamente.

## Notas / pegadinhas já resolvidas (não devem voltar, mas documentado por contexto)

- **Imports relativos em `backend/src/db/schema/*.ts` sem extensão `.js`**: quebrava só em
  produção (Node puro), nunca em dev (`tsx` é mais tolerante com isso). Já corrigido — todo import
  relativo nesse projeto precisa terminar em `.js`, mesmo apontando pra um arquivo `.ts` (convenção
  exigida por ESM + `"type": "module"`). Se você criar um arquivo novo em `backend/src/`, lembre
  disso.
- Senhas/secrets de produção (banco, JWT, VAPID) foram gerados na hora, nunca reaproveitados de
  outro app desse VPS — cada app tem os seus, isolados.
