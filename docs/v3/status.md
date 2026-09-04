# Estado da v3

**Versão-alvo:** `3.0.0` · **Última verificação:** 2026-09-04

> A `3.0.0` estável **não** pode ser publicada a partir deste estado — mas o
> motivo mudou. A matriz de paridade está verde nas nove células; o que falta é
> a fase 7 (exemplos, migração validada, cobertura). A lista está no fim desta
> página.

Esta página descreve o que existe e o que falta. O
[design aprovado](../superpowers/specs/2026-09-03-v3-paridade-orm-bancos-design.md)
descreve o que foi decidido, e não deve ser editado para acompanhar o
progresso — é registro de decisão.

## Como ler as evidências

Duas coisas diferentes são chamadas de "teste verde" neste projeto, e confundir
as duas é a forma mais fácil de superestimar o estado:

- **Dialeto de referência (SQLite).** Prova que o compilador do adapter
  implementa a semântica do plano. É rápido, roda em `pnpm test` e **não** é
  célula da matriz de paridade.
- **Matriz de paridade (PostgreSQL, MySQL, SQL Server).** É a promessa da §5:
  mesma query, mesmo resultado nas nove combinações. Roda em
  `pnpm test:integration`, uma célula por execução
  (`DQB_ADAPTER` × `DQB_DIALECT`), e exige os bancos do perfil certificado no
  ar. **As nove rodaram**, 66 casos cada, sem skip.

Verde na matriz também não é auto-evidente: três células verdes de primeira
foram conferidas pelo SQL realmente executado — digest e general log no MySQL,
cache de planos no SQL Server — porque uma célula que não chega ao banco
passaria igual.

## Fases de entrega

| Fase | Escopo                | Estado           | Evidência                                                                                          |
| ---- | --------------------- | ---------------- | -------------------------------------------------------------------------------------------------- |
| 0    | Contrato e baseline   | **completa**     | corpus congelado em `tests/v3/corpus/`, perfis em `test/profiles/`                                 |
| 1    | Core semântico        | **completa**     | parser, AST, autorização exata, codecs, plano, normalizador                                        |
| 2    | API e distribuição    | **completa**     | sources discriminadas, `transformPlan`, `customize` com escopo, 4 subpaths, `verify:package` verde |
| 3    | TypeORM de referência | **completa**     | 66/66 em SQLite e nas três células reais                                                           |
| 4    | Prisma                | **completa**     | 66/66 em SQLite e nas três células reais; manifesto validado contra os 4 `schema.prisma`           |
| 5    | Drizzle               | **completa**     | 66/66 em SQLite e nas três células reais, via `postgres-js`, `mysql2` e `node-mssql`               |
| 6    | Paridade completa     | **completa**     | nove células verdes, 66 casos cada, `assert-no-skips` em todas                                     |
| 7    | Hardening e release   | **não iniciada** | exemplos, migration validado, alpha/rc (codemod saiu do escopo — ADR-001)                          |

As fases de adapter fecharam junto com a 6: completa exigia as três células
reais de cada um, e é o que existe agora.

## Estado por adapter

|                                 | TypeORM        | Prisma                                          | Drizzle                            |
| ------------------------------- | -------------- | ----------------------------------------------- | ---------------------------------- |
| Corpus no dialeto de referência | 66/66          | 66/66                                           | 66/66                              |
| Usa o ORM de verdade            | sim            | sim, client gerado por dialeto                  | sim                                |
| PostgreSQL / MySQL / SQL Server | 66/66 nas três | 66/66 nas três                                  | 66/66 nas três                     |
| Divergências declaradas         | nenhuma        | 5 operadores de padrão em SQLite e MSSQL        | nenhuma                            |
| Lacuna própria                  | —              | generator a partir de `schema.prisma` (`3.1.0`) | coleção aninhada sob outra relação |

### TypeORM

Adapter de referência. Junções idempotentes para filter, search, sort e fields
mesmo sem `includes`; joins de predicado separados dos de apresentação; PKs
compostas; paginação em duas fases quando a projeção inclui relação `many`.

### Prisma

`prismaSource`, `PrismaAdapter` e manifesto **escrito à mão** e validado na
inicialização. Relação `many` usa `some`/`none`, `one` usa `is`/`isNot`; o
perfil portável consulta folded fields e nunca emite `mode: 'insensitive'`.

O generator que derivaria o manifesto de um `schema.prisma` **não existe** —
é a lacuna que impede a fase 4 de fechar mesmo com o corpus verde.

### Drizzle

`drizzleSource`, `DrizzleAdapter` e `drizzleDatabase()` sobre `drizzle-orm`.
Relações declaradas por path pontuado, planner de junções idempotente, `EXISTS`
correlacionado para qualquer salto `many`, coleção de primeiro nível hidratada
por consulta própria. `ILIKE` nunca é emitido.

`drizzle-orm` está fixado em `1.0.0-rc.4`, que **já traz o driver MSSQL**
(`node-mssql/`). O que falta é o GA, não o suporte a SQL Server — o
[ADR-001](../superpowers/specs/2026-09-04-v3-adr-001-matriz-e-escopo-da-3.0.0.md)
desfaz essa confusão e desamarra a estável do GA por meio de uma faixa de peer
fechada.

**O adapter não executa em nenhum banco real.** `drizzleDatabase()` executa por
`client.all(query)`, e `all()` é exclusivo do SQLite no objeto `db` do
`drizzle-orm`: medido em runtime, `db.all` é `undefined` em `node-postgres`,
`postgres-js`, `mysql2` e `node-mssql`, que expõem só `execute()`. O guard em
`drizzle-database.ts:165` lança para as três células reais. O
`as unknown as DrizzleClientLike` em `tests/v3/adapters/drizzle/helpers.ts:45`
é o que impediu o compilador de acusar isso, e é por ele que o corpus 66/66
prova **SQLite, e só**.

## Divergências intencionais

Divergência é exceção, não acomodação: fica declarada como dado no próprio caso
do corpus (`tests/v3/corpus/cases.ts`), com justificativa obrigatória, e é
comparada com o mesmo rigor da expectativa canônica. Um adapter que volte a
concordar quebra o build e força a remoção da exceção.

| Adapter | Caso                         | Por quê                                                                                                                                                                                                                                               |
| ------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prisma  | `like/underscore-is-literal` | O Prisma compila `contains` para `LIKE ('%' \|\| ? \|\| '%')` sem cláusula `ESCAPE` e não escapa metacaracteres; o client tipado não permite fornecê-la. `%` e `_` viram coringas em `like`, `notLike`, `ilike`, `notIlike` e `search`, contra a §11. |

Atenção ao ler o corpus: `like/percent-is-literal` passa no Prisma **por
coincidência** — exatamente um nome do seed contém "100". Aquele verde não é
cobertura.

## Gates da `3.0.0` (§23)

| Gate                                            | Estado                                                                              |
| ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| Nove combinações reais verdes, sem skips        | **sim** — 66 casos por célula, `assert-no-skips` em todas                           |
| Peer do Drizzle fechado nos RCs medidos         | sim — `>=1.0.0-rc.4 <1.0.0`                                                         |
| Nenhum cast no uso público documentado          | sim                                                                                 |
| Nenhum peer opcional carregado pelo core        | sim — provado por consumer fixture                                                  |
| Exemplos compilam e passam smoke E2E            | **não** — fase 7                                                                    |
| Códigos de erro e JSON canônico idênticos       | sim — mesmo runner e mesmas expectativas nas nove células                           |
| Cobertura de branches críticos acima de 95%     | **parcial** — ver abaixo                                                            |
| Nenhum achado de segurança alto ou crítico      | CodeQL e Scorecard rodam na CI; falta datar o resultado                             |
| Benchmarks dentro do orçamento                  | `budget.spec.ts` mede o §18.4 em `pnpm test`; falta datar                           |
| Migration guide validado num consumidor v2 real | **não**                                                                             |
| Matriz pública de versões coincide com a CI     | sim — `versions.md`, comparada ao workflow por teste                                |
| Profiles de banco passam nos checks             | **parcial** — collector existe em `src/`, mas não confere o fuso do _cliente_ (nº3) |

### Cobertura

Medida na última execução completa de `pnpm test`:

| Área                     | Statements | Branches |
| ------------------------ | ---------- | -------- |
| Total                    | 95.31%     | 87.71%   |
| `infra/adapters/prisma`  | 98.59%     | 96.73%   |
| `infra/adapters/drizzle` | 97.97%     | 94.28%   |
| `infra/adapters/typeorm` | 92.14%     | 75.00%   |

O gate pede branches acima de 95% nos caminhos críticos. O adapter TypeORM,
que é o de referência, está em 75% — é a maior dívida de cobertura aberta.

## Bloqueadores nomeados

A paridade deixou de ser um deles. O que resta é fase 7, mais um achado novo
que a própria matriz produziu.

1. **Fase 7 não iniciada.** Os quatro exemplos em `apps/examples/` usam a API
   v2 e não compilam contra a v3; o `MIGRATION.md` não foi exercido num
   consumidor v2 real. São dois gates da §23.
2. **Cobertura de branches.** `infra/adapters/typeorm` em 75% e
   `infra/adapters/drizzle` em 94.6%, contra um gate de 95%.
3. **O perfil certificado não confere o fuso do cliente.** Achado da matriz, e
   é de biblioteca, não de harness: o TypeORM força `useUTC: false` no driver
   do SQL Server quando `options.useUTC` não vem marcado, e `datetime2` passa a
   ser gravado no fuso local do processo. `assertProfileFacts` confere o fuso do
   **servidor** e passaria assim mesmo. Ver "O que a matriz descobriu".
4. **Coleção aninhada sob outra relação no Drizzle** falha fechado.
5. **`decimal(38,6)` não passa como parâmetro vinculado no tedious.** O
   `Decimal` do tedious 20 faz `parseFloat` na validação e `writeUInt64LE`
   depois, então os 8 bytes altos da forma de 16 saem zerados. O seed contorna
   com literal SQL; um consumidor que grave decimal de alta precisão em SQL
   Server pelo TypeORM encontra o mesmo teto.
6. **Operadores de padrão do Prisma em SQLite e SQL Server** são recusados com
   `CAPABILITY_UNAVAILABLE`. É decisão declarada (ADR-001, emenda 2), não
   pendência, e está em [`versions.md`](./versions.md) como não suportado.

## O que a matriz descobriu

A paridade pagou o próprio custo na primeira execução completa, e vale
registrar porque é o argumento de por que existem nove células em vez de uma
suíte por adapter.

**`coercion/datetime-offset-normalized-to-utc` passava no TypeORM × SQL Server
com o dado errado.** O TypeORM força `useUTC: false` no tedious, então
`2026-01-02T03:04:05Z` foi gravado como `2026-01-02 00:04:05` — o fuso local do
processo. A célula passava porque escrevia e lia com o mesmo deslocamento: um
erro auto-consistente. Prisma e Drizzle, que ficam em UTC, leram o instante
errado e falharam.

Nenhuma suíte de um adapter só encontraria isso. É o mesmo dado lido por três
compiladores que expõe o erro — que é exatamente a definição de paridade da §5.

O harness passou a declarar `useUTC: true`, mas o bloqueador nº3 continua
aberto: um consumidor que não marque a opção tem o mesmo problema, e o check de
perfil não acusa.

## Como reproduzir

```bash
pnpm install
pnpm test              # inclui os 3 corpus no dialeto de referência
pnpm typecheck         # só `src/**`
pnpm typecheck:tests   # `tests/**`, que o typecheck e o ts-jest não cobrem
pnpm lint
pnpm verify:package    # build + publint + attw + consumidores CJS/ESM

# Uma célula da matriz. Cada execução é um par (adapter, dialeto): o
# `test:integration` roda um só, e é `assert-no-skips` que impede uma
# célula de passar sem ter rodado caso nenhum.
pnpm db:up
DQB_ADAPTER=prisma DQB_PRISMA_SCHEMA=postgres pnpm prisma:generate:cell
DQB_ADAPTER=prisma DQB_DIALECT=postgres \
  DQB_PG_URL=postgres://dqb:dqb@localhost:55432/dqb \
  pnpm test:integration
node scripts/assert-no-skips.mjs integration.xml
pnpm db:down
```

`pnpm test` gera o client Prisma de SQLite antes de rodar (`pretest`) e usa
`--experimental-vm-modules`, porque o runtime do Prisma 7 se carrega por
`import()` dinâmico. O `test:integration` precisa da mesma flag — sem ela, 42
dos 66 casos da célula do Prisma falham por callback de import dinâmico.

O `provider` do `datasource` do Prisma tem de ser literal, então existe um
`schema.prisma` por dialeto em `tests/v3/adapters/prisma/schema/` e o client da
célula é gerado por `DQB_PRISMA_SCHEMA`. Os quatro são validados contra o mesmo
manifesto por `manifest-matches-schema.spec.ts`.
