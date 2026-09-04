<div align="center">
  <img src="../../docs/public/logomark.svg" width="40" /><br><br>
</div>

<div align="center">

# 03 - App with Drizzle

`nestjs-rest-query` v3 sobre **Drizzle ORM 1.x** e **PostgreSQL**

</div>

---

## O que este exemplo prova

Que a API pública v3 é usável **de fora**, por uma aplicação NestJS real, contra
um Postgres real, sem cast e sob `strict`. A suíte de paridade da biblioteca
mede outra coisa (a semântica, nas nove células ORM × banco); este exemplo mede
a superfície.

Três endpoints, três formas diferentes de relação:

| Endpoint     | Relação declarada                         | O que exercita                                                             |
| ------------ | ----------------------------------------- | -------------------------------------------------------------------------- |
| `/users`     | `company` (one, nulável) + `posts` (many) | junção de apresentação, `company: null`, coleção hidratada                 |
| `/companies` | `users` (many)                            | coleção de primeiro nível: `LIMIT` pagina empresas, `total` conta empresas |
| `/posts`     | `user` (one, **não** nulável)             | contrato de JSON sem `null`, e `isNull` recusado na construção             |

## Como rodar

```bash
pnpm db:up          # Postgres 16 em localhost:5433 (docker compose)
pnpm seed           # cria o schema do zero e popula
pnpm dev            # API em http://localhost:3002, Swagger na raiz
```

Requisições prontas em `src/http/*.http`. Smoke E2E:

```bash
pnpm test:e2e       # prepara o banco, roda, e limpa no fim
```

O E2E precisa do Postgres no ar e usa o mesmo banco (`app_db_drizzle`): ele
derruba e recria as tabelas, então não rode em cima de dados que interessem.

## Como a v3 é montada aqui

### 1. `forRoot` só configura políticas

```ts
DynamicQueryBuilderModule.forRoot({
  pagination: { defaultPerPage: 10, maxPerPage: 100 },
  textProfile: 'portable-strict',
  consistency: 'eventual',
});
```

Não existe `adapter` aqui — quem determina o adapter é a source que o serviço
monta. Passar `adapter` ou `operators` é rejeitado na inicialização com
`SOURCE_CONFIGURATION_INVALID`; restrição de operador agora é **por campo**.

### 2. Duas declarações da tabela, e uma verificação entre elas

- `src/db/schema.ts` — `pgTable` do Drizzle: o schema **físico**, usado pelo
  seed tipado.
- `src/db/tables.ts` — `DrizzleTable`/`DrizzleRelationMap`: o schema **lógico**,
  que é o que a v3 consome (tipo, nulabilidade, coluna interna, coluna dobrada,
  coluna de ordem portável, relações por path pontuado).

A biblioteca não deriva um do outro, então `tables.ts` confere os dois no load e
transforma divergência em erro de inicialização. A regra que ele impõe: **path
lógico e nome físico têm de ser a mesma string**, porque o compilador SQL do
adapter emite a chave lógica como identificador da coluna. É por isso que as
colunas no Postgres se chamam `"companyId"` e `"createdAt"`, e não
`company_id`/`created_at`.

### 3. Regras por endpoint, whitelist exata

`src/*/**.query.ts` monta o registro de schemas com `buildSourceSchema` — a
mesma função que `drizzleSource` usa para descrever a source, o que elimina a
chance de o schema das regras divergir do schema da source — e declara as regras
com `defineQueryRules`. A whitelist é exata: autorizar `company` não autoriza
`company.name`, e cada campo declara os operadores que aceita.

### 4. Source discriminada, executor separado

```ts
this.queryBuilderService.execute(
  drizzleSource({
    db,
    dialect: 'postgres',
    table: usersTable,
    relations: userRelations,
  }),
  query,
  rules
);
```

O `db` injetado é o `DrizzleDatabase` que `drizzleDatabase({ client, dialect })`
devolve, não o `db` do Drizzle: o adapter compila o plano para um statement
explícito e o executor materializa aquele statement no dialeto. `sqlite` executa
por `all()`, Postgres por `execute()` — daí o dialeto ser declarado nos dois
lados, e `drizzleSource` falhar fechado se eles divergirem.

## Colunas que existem para o contrato, não para o domínio

| Coluna    | Papel                | Por que                                                                                                                            |
| --------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `*Folded` | `foldedField`        | `search`, `ilike` e `notIlike` comparam esta coluna literalmente. `ILIKE` nunca é emitido, e o resultado não depende da collation. |
| `idOrder` | `portableOrderField` | `uuid` não tem ordem total idêntica nas três famílias de banco, e a v3 anexa a PK como desempate em **toda** página.               |

As duas são preenchidas pela aplicação na escrita, com o `foldText` que o pacote
exporta (ver `src/database/bootstrap.ts`). O schema lógico as marca `internal`,
então elas nunca aparecem no JSON — nem quando o campo que apoiam é projetado.

Sem `idOrder`, todo `GET` falharia com `CAPABILITY_UNAVAILABLE`, não só os que
pedem `sort=id`.

## O DDL não sai do `drizzle-kit push`

`push` não sabe pedir `COLLATE "C"`, e comparação por code point nas colunas
textuais portáveis é parte da promessa de portabilidade — sem ela a mesma query
ordena diferente em cada servidor. O DDL aplicado vive em
`src/database/bootstrap.ts`, alinhado ao perfil certificado de
`test/profiles/postgres`. `drizzle.config.ts` e `pnpm drizzle:generate` ficam
para inspeção do schema, não para aplicar.

## Limite conhecido

Coleção **aninhada sob outra relação** (`company.users` a partir de `/users`)
falha fechado com `ADAPTER_CONTRACT_VIOLATION` no adapter Drizzle: hidratar três
níveis não está implementado. Coleção de primeiro nível (`posts` em `/users`,
`users` em `/companies`) é suportada, e é o que este exemplo usa.

## Scripts

```bash
pnpm dev               # servidor com watch
pnpm build             # compila para dist/
pnpm db:up             # sobe o Postgres do docker-compose
pnpm db:down           # derruba o container e o volume
pnpm seed              # derruba, recria e popula
pnpm seed:keep         # só popula, sem tocar no schema
pnpm db:setup          # db:up && seed
pnpm drizzle:generate  # drizzle-kit generate (inspeção)
pnpm test:e2e          # smoke E2E contra o Postgres
```

## Ver também

- Biblioteca: [nestjs-rest-query](../../)
- Exemplo TypeORM mínimo: `01-starter-app`
- Exemplo TypeORM + Postgres: `02-app-with-postgres`
- Migração v2 → v3: [`docs/v3/migration-from-v2.md`](../../docs/v3/migration-from-v2.md)
