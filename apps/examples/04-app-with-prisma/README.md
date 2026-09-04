<div align="center">
  <img src="../../docs/public/logomark.svg" width="40" /><br><br>
</div>

<div align="center">

# 04 - App with Prisma

Exemplo do **nestjs-rest-query v3** com Prisma 7 e PostgreSQL

</div>

---

## O que este exemplo prova

Que a API pública v3 do adapter Prisma é usável **de fora**, num app NestJS
real, contra um PostgreSQL de verdade — sem cast, sem `any` e sem
`@ts-expect-error`. É o gate §23, e o smoke em `test/prisma.e2e-spec.ts` é a
medida dele.

Três endpoints, três models: `GET /users`, `GET /companies`, `GET /posts`.

## Como rodar

```bash
cp .env.example .env         # 1. DATABASE_URL
pnpm db:up                   # 2. Postgres 16 no Docker, porta 5434
pnpm db:setup                # 3. gera o client, recria o schema e popula
pnpm dev                     # 4. sobe a API
```

API em `http://localhost:3003`, Swagger na raiz.

```bash
pnpm test:e2e                # smoke E2E (prepara e limpa o próprio banco)
pnpm typecheck               # tsc --noEmit em strict
```

O `test:e2e` carrega `NODE_OPTIONS=--experimental-vm-modules`: o runtime do
Prisma 7 se carrega por `import()` dinâmico, e sem a flag a maioria dos casos
falha por callback de import dinâmico.

## O que muda em relação à v2

### 1. O adapter não vem mais da raiz

```diff
- import { DynamicQueryBuilderModule, PrismaAdapter } from 'nestjs-rest-query';
+ import { DynamicQueryBuilderModule } from 'nestjs-rest-query';
+ import { prismaSource } from 'nestjs-rest-query/prisma';
```

`forRoot` configura só políticas comuns. `adapter` e `operators` passaram a ser
**rejeitados** na inicialização — quem determina o adapter é a source, e a
restrição de operadores é por campo, nas regras do endpoint.

### 2. Schema lógico e regras declarados

`RulesConfig` saiu. Agora:

- `src/query/schemas.ts` — o schema lógico dos três models
  (`defineQuerySchema`), incluindo as colunas dobradas e o campo de ordem
  portável.
- `src/query/manifest.ts` — o **manifesto do Prisma**, escrito à mão
  (`createPrismaManifest`).
- `src/<módulo>/<módulo>.query.ts` — as regras do endpoint
  (`defineQueryRules`), com whitelist exata: autorizar a relação `company` não
  autoriza `company.name`.

Tudo é validado na construção: path inexistente, default fora de `allowed`,
operador incompatível com o tipo e sort ambíguo falham ao subir a aplicação,
não na primeira requisição.

### 3. O manifesto do Prisma é escrito à mão

Não existe equivalente ao `buildSchemaRegistry(repository)` do TypeORM: o
generator que derivaria o manifesto do `schema.prisma` é lacuna declarada para
a 3.1.0. Consequência prática: **nada valida o schema lógico contra o
`schema.prisma` nem contra o banco**. Um campo declarado com o nome errado só
aparece na primeira requisição que o tocar.

### 4. Prisma 6 → 7 (subida obrigatória, não opcional)

- `url` **saiu** do `datasource` do `schema.prisma`. Manter `url = env(...)`
  falha a geração com `P1012`. Quem conecta é o driver adapter
  (`@prisma/adapter-pg`), passado ao construtor do client.
- O generator virou `prisma-client` (não `prisma-client-js`), com `output` e
  `moduleFormat` explícitos. O client é gerado em `src/generated/prisma` e é de
  lá que se importa — `import { PrismaClient } from '@prisma/client'` não
  compila mais.
- Quem carrega o `.env` é a aplicação, não o Prisma.

### 5. `PrismaClientLike` exige uma ponte escrita à mão

`prismaSource({ client })` pede `Readonly<Record<string, PrismaDelegate>>`, e o
`PrismaClient` gerado não é atribuível a esse tipo. `src/prisma/prisma-client-like.ts`
atravessa a fronteira sem cast, com verificação em runtime, e explica por quê.
Isso é custo da biblioteca, não do exemplo.

## Banco

PostgreSQL 16 em `localhost:5434` (`pnpm db:down` para parar).

A DDL vive em `prisma/database.ts`, em SQL cru, e não em `prisma db push`: o
que sustenta a portabilidade é `COLLATE "C"` nas colunas textuais e a precisão
declarada, e `db push` deriva a DDL do `schema.prisma`, que não sabe declarar
collation. A referência é `test/profiles/postgres/profile.sql`.

Três tabelas:

| tabela      | colunas do domínio                             | colunas exigidas pela v3      |
| ----------- | ---------------------------------------------- | ----------------------------- |
| `companies` | id, name, created_at                           | `name_folded`                 |
| `users`     | id, name, email, company_id, created_at        | `name_folded`, `email_folded` |
| `posts`     | id (uuid), title, content, user_id, created_at | `title_folded`, `id_order`    |

- `*_folded` são as **colunas dobradas**. Sob o perfil `portable-strict`,
  `ilike` e `search` comparam valor dobrado contra coluna dobrada em vez de
  pedir `mode: 'insensitive'` ao Prisma — que dependeria da collation do
  servidor. **Preencher essas colunas na escrita é responsabilidade da
  aplicação**, com o helper `foldText` exportado pelo pacote.
- `posts.id_order` é o `portableOrderField` da PK UUID. O desempate de
  paginação é sempre sobre a PK, e UUID não tem ordem total idêntica nas três
  famílias de banco; sem essa coluna o endpoint falha na subida com
  `CAPABILITY_UNAVAILABLE`.

## Operadores de padrão neste exemplo

O Prisma nunca emite cláusula `ESCAPE`, então só sobra o escape default do
dialeto (ADR-001, emenda 2):

| provider                | `like`, `notLike`, `ilike`, `notIlike`, `search`           |
| ----------------------- | ---------------------------------------------------------- |
| `postgresql` (este app) | funcionam; `%` e `_` são **literais**, como a §11 exige    |
| `mysql`                 | idem                                                       |
| `sqlite`, `sqlserver`   | recusados com `CAPABILITY_UNAVAILABLE`, sem escape default |

O smoke fixa a literalidade em dois casos: `filter[title][like]=100%` não casa
`"1000 clientes atendidos"`, e `filter[title][like]=a_b` não casa
`"Circuito axb descontinuado"`.

## Exemplos de requisição

```bash
# envelope canônico
curl "http://localhost:3003/users?page=1&perPage=5"

# projeção exata (a coluna dobrada nunca sai no JSON)
curl "http://localhost:3003/users?fields=id,name"

# relação `one` com projeção aninhada
curl "http://localhost:3003/users?includes=company&fields=id,company.name"

# relação `many`: array, e `total` continua contando roots
curl "http://localhost:3003/companies?includes=users&fields=id,name,users.name"

# filtro através de relação `many` (vira `some` no Prisma)
curl "http://localhost:3003/users?filter[posts.title][ilike]=elétrica"

# busca portátil: a caixa do termo não muda o conjunto
curl "http://localhost:3003/users?search=ELÉTRICA"

# 400 FIELD_NOT_ALLOWED: `createdAt` é ordenável, mas não projetável
curl "http://localhost:3003/users?fields=id,createdAt"
```

Mais fixtures em `src/http/*.http`.

## Scripts

```bash
pnpm dev          # sobe a API em watch
pnpm build        # compila (inclui o client gerado)
pnpm typecheck    # tsc --noEmit, strict
pnpm db:up        # sobe o Postgres
pnpm db:down      # para o Postgres
pnpm db:generate  # gera o client do Prisma em src/generated/prisma
pnpm seed         # recria o schema e popula
pnpm db:setup     # db:generate && seed
pnpm test:e2e     # smoke E2E
```

## Ver também

- Biblioteca: [nestjs-rest-query](../../)
- Guia de migração v2 → v3: [`docs/v3/migration-from-v2.md`](../../docs/v3/migration-from-v2.md)
- Exemplo TypeORM: `01-starter-app`, `02-app-with-postgres`
- Exemplo Drizzle: `03-app-with-drizzle`
