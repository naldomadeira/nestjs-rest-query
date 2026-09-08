# Estado da v3

**Versão-alvo:** `3.0.0` · **Última verificação:** 2026-09-04 (Node v24.15.0)

> A `3.0.0` estável está a **dois gates** de sair, e nenhum dos dois é
> trabalho: a matriz de paridade fechou verde nas nove células com 74 casos
> cada, a fase 7 terminou, e o que resta — varredura de segurança sobre código
> v3 e validação por um consumidor de fora — só existe depois que o stack
> aterrissar em `main` e o `3.0.0-alpha.1` for publicado. A lista está no fim.

Esta página descreve o que existe e o que falta. O
[design aprovado](../superpowers/specs/2026-09-03-v3-paridade-orm-bancos-design.md)
descreve o que foi decidido, e não deve ser editado para acompanhar o
progresso — é registro de decisão, como o
[plano de entrega](../superpowers/specs/2026-09-04-v3-plano-de-entrega.md) e a
[ADR-001](../superpowers/specs/2026-09-04-v3-adr-001-matriz-e-escopo-da-3.0.0.md).

## Como ler as evidências

Três coisas diferentes são chamadas de "teste verde" neste projeto, e confundir
qualquer par delas é a forma mais fácil de superestimar o estado:

- **Dialeto de referência (SQLite).** Prova que o compilador do adapter
  implementa a semântica do plano. Roda em `pnpm test` e **não** é célula da
  matriz.
- **Matriz de paridade (PostgreSQL, MySQL, SQL Server).** É a promessa da §5:
  mesma query, mesmo resultado nas nove combinações. Roda em
  `pnpm test:integration`, uma célula por execução (`DQB_ADAPTER` ×
  `DQB_DIALECT`), e exige os bancos do perfil certificado no ar.
- **Smoke E2E dos exemplos.** É o único gate que atravessa a fronteira do
  pacote **publicado**: os exemplos consomem `nestjs-rest-query` por
  `workspace:*`, ou seja pelos `exports` e pelo `dist`, nunca pelo `src`. Duas
  correções da v3 existem porque este gate falhou primeiro — nenhuma suíte de
  dentro as encontraria.

## Fases de entrega

| Fase | Escopo                | Estado       | Evidência                                                                                        |
| ---- | --------------------- | ------------ | ------------------------------------------------------------------------------------------------ |
| 0    | Contrato e baseline   | **completa** | corpus em `tests/v3/corpus/`, perfis em `test/profiles/`                                         |
| 1    | Core semântico        | **completa** | parser, AST, autorização exata, codecs, plano, normalizador                                      |
| 2    | API e distribuição    | **completa** | sources discriminadas, `transformPlan`, `customize` com escopo, 4 subpaths, `verify:package`     |
| 3    | TypeORM de referência | **completa** | corpus verde em SQLite e nas três células reais; branches em 100%                                |
| 4    | Prisma                | **completa** | idem, com client gerado por dialeto e manifesto validado contra os 4 `schema.prisma`             |
| 5    | Drizzle               | **completa** | idem, via `postgres-js`, `mysql2` e `node-mssql`                                                 |
| 6    | Paridade completa     | **completa** | nove células verdes com 74 casos cada, `assert-no-skips` em todas                                |
| 7    | Hardening e release   | **completa** | exemplos, guias, cobertura e bench fechados; falta publicar alpha/rc e datar segurança em `main` |

## Estado por adapter

|                                 | TypeORM            | Prisma                                          | Drizzle                            |
| ------------------------------- | ------------------ | ----------------------------------------------- | ---------------------------------- |
| Corpus no dialeto de referência | 74/74              | 74/74 (7 com recusa declarada)                  | 74/74                              |
| Usa o ORM de verdade            | sim                | sim, client gerado por dialeto                  | sim                                |
| PostgreSQL / MySQL / SQL Server | **74/74 nas três** | **74/74 nas três**                              | **74/74 nas três**                 |
| Branches                        | **100%**           | **100%**                                        | **100%**                           |
| Divergências declaradas         | nenhuma            | 5 operadores de padrão em SQLite e MSSQL        | nenhuma                            |
| Lacuna própria                  | —                  | generator a partir de `schema.prisma` (`3.1.0`) | coleção aninhada sob outra relação |

### TypeORM

Adapter de referência. Junções idempotentes para filter, search, sort e fields
mesmo sem `includes`; joins de predicado separados dos de apresentação; PKs
compostas; paginação em duas fases quando a projeção inclui relação `many`;
`EXISTS` correlacionado — com correlação por FK composta — para filtro e para
busca que cruzem relação, de qualquer profundidade.

A cadeia sai como **um único `EXISTS`**, correlacionado ao root uma só vez, com
os saltos seguintes como `INNER JOIN` dentro da subconsulta; correlacionar por
fora inflaria roots e estragaria o `total`. Many-to-many entra pela **tabela de
junção**, com o alvo por join. Até o PR5 as duas formas eram recusadas, e antes
disso a m2m era pior que recusada: emitia `EXISTS` sintaticamente válido contra
a **tabela errada**, porque a guarda testava `joinColumns.length === 0` e numa
m2m o lado dono tem join columns — as da junção. Resultado válido e errado, em
silêncio.

Os identificadores da junção são citados pelo `escape` do driver, e são os
únicos do SQL emitido que recebem esse tratamento: a naming strategy do TypeORM
os gera em camelCase (`articlesId`), e sem aspas o PostgreSQL os dobraria para
minúsculas. Uniformizar a citação no resto do compilador é dívida declarada no
plano de entrega.

### Prisma

`prismaSource`, `PrismaAdapter` e manifesto **escrito à mão**, validado na
inicialização. Relação `many` usa `some`/`none`, `one` usa `is`/`isNot`; o
perfil portável consulta folded fields e nunca emite `mode: 'insensitive'`.

`prismaSource({ client })` aceita o `PrismaClient` gerado **direto, sem cast**.
Não era assim: o campo era tipado `Readonly<Record<string, PrismaDelegate>>` e
nenhum `PrismaClient` real satisfazia esse tipo — classe não recebe index
signature implícita em TypeScript. O harness da biblioteca escondia com
`as never`, e o exemplo 04 precisou de uma ponte de 20 linhas até isto ser
corrigido. O delegate nomeado pelo manifesto passou a ser validado em runtime na
construção da source.

O generator que derivaria o manifesto de um `schema.prisma` **não existe** — é
a lacuna declarada para a `3.1.0`.

### Drizzle

`drizzleSource`, `DrizzleAdapter` e `drizzleDatabase({ client, dialect })` sobre
`drizzle-orm 1.0.0-rc.4`. Relações por path pontuado, planner de junções
idempotente, `EXISTS` correlacionado para qualquer salto `many` — inclusive
cadeias, com o segundo salto como join **dentro** da subconsulta —, coleção de
primeiro nível hidratada por consulta própria. `ILIKE` nunca é emitido.

## Divergências e limites declarados

Divergência é exceção, não acomodação: fica declarada como dado no próprio caso
do corpus (`tests/v3/corpus/cases.ts`), com justificativa obrigatória, e é
comparada com o mesmo rigor da expectativa canônica. Um adapter que volte a
concordar quebra o build e força a remoção da exceção.

| Adapter | Caso                                                                       | Por quê                                                                                                                                                                                          |
| ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Prisma  | `like/underscore-is-literal` e os demais de padrão, em SQLite e SQL Server | O Prisma compila `contains` sem cláusula `ESCAPE` e o client tipado não permite fornecê-la; esses dois dialetos não têm escape default. Recusa com `CAPABILITY_UNAVAILABLE` (ADR-001, emenda 2). |

Atenção ao ler o corpus: `like/percent-is-literal` passa no Prisma **por
coincidência** — exatamente um nome do seed contém "100". Aquele verde não é
cobertura.

**Uma divergência só, e é a do Prisma.** O limite do TypeORM que esta página
declarava — condição existencial atravessando mais de uma relação, ou uma
many-to-many — deixou de existir: a
[Emenda 1 do plano de entrega](../superpowers/specs/2026-09-04-v3-plano-de-entrega.md)
foi implementada, os três adapters compilam as mesmas formas, e três casos
novos do corpus medem isso **sem** exceção declarada.

## Gates da `3.0.0` (§23)

| Gate                                            | Estado                                                                                      |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Nove combinações reais verdes, sem skips        | **sim** — 74 casos por célula, `assert-no-skips` em todas, medido em 2026-09-04             |
| Peer do Drizzle fechado nos RCs medidos         | sim — `>=1.0.0-rc.4 <1.0.0`                                                                 |
| Nenhum cast no uso público documentado          | sim — provado pelos quatro exemplos em `strict`, que foi o que o achou                      |
| Nenhum peer opcional carregado pelo core        | sim — provado por consumer fixture                                                          |
| Exemplos compilam e passam smoke E2E            | **sim** — 61 testes E2E, job `examples` na CI                                               |
| Códigos de erro e JSON canônico idênticos       | sim — mesmo runner e mesmas expectativas nas nove células                                   |
| Cobertura de branches críticos acima de 95%     | **sim** — três adapters em 100%, com piso por área no `jest.config.ts`                      |
| Nenhum achado de segurança alto ou crítico      | **não datável ainda** — CodeQL e Scorecard rodam contra `main`, que não tem uma linha da v3 |
| Benchmarks dentro do orçamento                  | **sim, datado** — ver abaixo                                                                |
| Migration guide validado num consumidor v2 real | **sim** — três consumidores, 32 furos achados e corrigidos                                  |
| Matriz pública de versões coincide com a CI     | sim — `versions.md`, comparada ao workflow por teste                                        |
| Profiles de banco passam nos checks             | sim — collector em `src/`, incluindo o fuso do cliente por sonda                            |

### Benchmark (§18.4), datado

Medido em 2026-09-04, Node v24.15.0, três execuções, **sob carga** (load
average ~2), o que só torna o número pessimista:

| Caso                       | Orçamento | p95 medido       |
| -------------------------- | --------- | ---------------- |
| 50 filtros, núcleo sem I/O | < 1 ms    | 0.147 – 0.261 ms |
| Query completa do corpus   | < 2 ms    | 0.050 – 0.097 ms |

`budget.spec.ts` roda em `pnpm test` e reprova o build se o orçamento estourar.
Benchmark com I/O mediria a latência do banco, não da biblioteca.

### Cobertura

Medida na última execução completa de `pnpm test:cov` (52 suites, **912
testes**, zero skip):

| Área                       | Statements | Branches   | Piso no `jest.config.ts` |
| -------------------------- | ---------- | ---------- | ------------------------ |
| Total                      | 97.45%     | 92.98%     | —                        |
| `infra/adapters/typeorm`   | **100%**   | **100%**   | 100% (catraca)           |
| `infra/adapters/prisma`    | **100%**   | **100%**   | 100% (catraca)           |
| `infra/adapters/drizzle`   | **100%**   | **100%**   | 100% (catraca)           |
| `core`                     | 95.87%     | 91.52%     | 95 / 91                  |
| `api` (superfície Swagger) | 90.44%     | **62.50%** | 90 / 62                  |

Os pisos são o valor medido arredondado para baixo, não metas. Os adapters
entram em 100% de propósito: é por eles que passa a promessa de paridade, e
catraca é o único regime que impede erosão silenciosa. `api` a 62% de branches é
o número honesto — não é caminho crítico do gate, e está declarado aqui e no
piso justamente para não piorar sem ninguém notar.

`src/contracts` **não aparece nesta tabela porque não há o que medir**: os 9
arquivos são type-only, o que `tests/v3/contracts/type-only.spec.ts` prova
transpilando cada um e exigindo que o JavaScript emitido não tenha instrução
executável. Antes disso eles eram apenas _ignorados_ pelo
`coveragePathIgnorePatterns`, o que dava a pior das três saídas: um gate que
nunca é atingido nem reprovado, só ausente — e portanto parece medido.

O `fast-check` roda com **seed fixo** (`tests/v3/setup/fast-check.ts`), e isso é
pré-requisito do piso, não preferência: com seed aleatório a cobertura oscilava
entre execuções com a mesma contagem de testes (`validate-pagination.ts` variou
91.17% ↔ 97.05%), e um piso reprovaria de forma intermitente quem não mexeu em
nada.

## Bloqueadores e pendências nomeadas

O que sobrou depois do PR5 — e os dois primeiros são os únicos que impedem a
`3.0.0` de sair.

1. **Publicar `3.0.0-alpha.1`.** Dois gates da §23 — build em consumidor
   isolado e guia de migração validado num projeto v2 de terceiro — só podem ser
   provados por alguém de fora. Pular o alpha significa descobri-los num rc.
2. **O gate de segurança não é datável a partir daqui.** CodeQL e Scorecard
   rodam contra `main`, e `main` não tem uma linha da v3: datar a varredura
   atual seria pendurar num gate da `3.0.0` o resultado de uma varredura de
   código v2. Fecha quando o stack aterrissar.
3. **Coleção aninhada sob outra relação no Drizzle** falha fechado.
4. **`decimal(38,6)` não passa como parâmetro vinculado no tedious.** O
   `Decimal` do tedious 20 faz `parseFloat` na validação e `writeUInt64LE`
   depois, então os 8 bytes altos da forma de 16 saem zerados. O seed contorna
   com literal SQL; um consumidor que grave decimal de alta precisão em SQL
   Server pelo TypeORM encontra o mesmo teto.
5. **Operadores de padrão do Prisma em SQLite e SQL Server** são recusados. É
   decisão declarada (ADR-001, emenda 2), não pendência.
6. **Citação de identificadores é inconsistente no adapter TypeORM.** Só os da
   tabela de junção passam pelo `escape` do driver, porque a naming strategy os
   gera em camelCase e sem aspas o PostgreSQL os dobraria. O resto do
   compilador emite identificador cru. Funciona hoje porque os demais nomes vêm
   do consumidor, que os escolhe compatíveis; uniformizar é decisão maior que a
   emenda que criou o caso.
7. **`reorderByKeys` é rede, não mecanismo.** A ordem da paginação em duas fases
   é imposta pelo `ORDER BY` que o clone de hidratação herda do plano; a
   reordenação em memória só casa chave crua com chave hidratada quando as duas
   representações coincidem, o que não acontece para PK `datetime` ou binária
   (`getRawMany` devolve o valor do driver, `getMany` devolve `Date`). Hoje é
   benigno e `composite-pagination.spec.ts` trava a ordem observável; deixa de
   ser no dia em que algo puder remover o `ORDER BY` da hidratação.
8. **`dynamic-query-builder.module.ts` não é medido por cobertura.** O
   `coveragePathIgnorePatterns` exclui `.module.ts$`, e as duas guardas novas do
   `forRoot` — as que recusam `database-native` e `transactional` — são testadas
   sem serem medidas. É o mesmo "parece medido" que `src/contracts` tinha, e a
   mesma decisão está aberta: estreitar o pattern ou provar que não há o que
   medir.

## O que o PR5 encontrou

Vale registrar, porque cada item foi achado por um gate que não existia antes e
nenhum deles apareceria na suíte da biblioteca sozinha.

**`search` através de relação `many` devolvia página curta em silêncio.**
`PlanFilter` carregava a marca `existential`; `PlanSearch.targets` não carregava
nenhuma. Prisma e Drizzle acertavam por derivar a cardinalidade sozinhos, e o
TypeORM, que confia no plano, compilava LEFT JOIN de predicado: o `LIMIT` caía
sobre linhas duplicadas e a página voltava menor que `perPage`, sem erro.
Medido no exemplo 02 contra PostgreSQL — `perPage=5` devolvendo 4 linhas para 24
roots que casavam. O corpus ganhou
`search/through-many-is-existential`, e o red/green foi medido revertendo só o
conserto do TypeORM.

**Nenhum adapter compilava `NOT IN` com valores.** O corpus só tinha
`notIn=[]`, que é sempre-verdadeiro e é elidido do `AND`. Quatro casos novos
fecharam o furo, incluindo a lógica de três valores do SQL: coluna nula não sai
por `notIn`, valor ausente por join também não, e `null` na lista é recusado
antes do compilador.

**Um tipo público que nenhum consumidor real satisfazia.** Ver a seção do
Prisma. É o mesmo defeito do commit `5fd238c`, do outro lado da fronteira: lá a
`DynamicQueryDto`, sendo classe, não era atribuível ao próprio `execute()`.

**Dois testes que mentiam.** Um prometia no nome ordenar por cadeia de relações
e ordenava por coluna de root, deixando metade de `prisma-sort.compiler.ts` sem
executar; outro passava pelo motivo errado, porque a PK que ele dizia reparar já
entrava no select de graça. Foram encontrados exatamente por perseguir os ramos
descobertos.

**Uma opção de configuração que reprovava 100% das requisições, e outra que
degradava calada.** `consistency: 'transactional'` era aceita por `forRoot` e
recusada em todo `execute`, porque nenhum adapter embarcado oferece a garantia.
`textProfile: 'database-native'` era aceita e dava o pior dos dois mundos —
pulava a checagem de portabilidade e mantinha compilação `portable-strict`. As
duas passaram a falhar na inicialização, que é o que a §17 manda
("configuração inválida falha na inicialização").

**Parâmetro de query desconhecido era ignorado em silêncio**, com o código
`QUERY_SYNTAX_UNKNOWN_PARAM` declarado, nunca lançado, e o JSDoc da
`DynamicQueryDto` afirmando que a recusa existia. Agora é 400 com a chave
ofensora em `details`. É a mudança de comportamento mais provável de aparecer
como "funcionava na v2": `?utm_source=`, cache-buster de jQuery e `?lang=` de
middleware passam a ser recusados.

**Um campo público declarado e ignorado.** `DrizzleColumn.name` prometia o nome
físico da coluna e o compilador emitia a **chave** do objeto `columns` como
identificador. `{ companyId: { name: 'company_id' } }` compilava, passava na
validação de source, a aplicação subia, e o erro aparecia no banco como
`column "companyId" does not exist`. Achado pelo exemplo 03, que pagou o preço
nomeando as colunas físicas em camelCase.

**Erro de lint fora do glob não era pego por gate nenhum.** `pnpm lint` era
`eslint "src/**/*.ts"`; virou `eslint .` e passou a cobrir `src`, `tests`,
`apps/docs` e os quatro exemplos.

## Como reproduzir

```bash
pnpm install
pnpm test              # 3 corpus no dialeto de referência + piso de cobertura
pnpm typecheck         # só `src/**`
pnpm typecheck:tests   # `tests/**`, que o typecheck e o ts-jest não cobrem
pnpm lint              # `eslint .` — repo inteiro, exemplos incluídos
pnpm verify:package    # build + publint + attw + consumidores CJS/ESM

# Smoke E2E dos exemplos: atravessa os `exports` e o `dist`, não o `src`.
pnpm build
docker compose -f apps/examples/02-app-with-postgres/docker-compose.yml up -d --wait
docker compose -f apps/examples/03-app-with-drizzle/docker-compose.yml up -d --wait
docker compose -f apps/examples/04-app-with-prisma/docker-compose.yml up -d --wait
pnpm --filter "./apps/examples/*" typecheck
pnpm --filter 01-starter-app test:e2e   # e 02, 03, 04

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

O SQL Server precisa do profile aplicado à mão depois do `db:up` — a imagem não
roda script de init:

```bash
docker compose -f test/profiles/docker-compose.yml exec -T mssql \
  /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P 'Dqb_Str0ng!' -C \
  -i /profile/profile.sql
```

`pnpm test` gera o client Prisma de SQLite antes de rodar (`pretest`) e usa
`--experimental-vm-modules`, porque o runtime do Prisma 7 se carrega por
`import()` dinâmico. O `test:integration` precisa da mesma flag — sem ela, 42
dos 74 casos da célula do Prisma falham por callback de import dinâmico.

O `provider` do `datasource` do Prisma tem de ser literal, então existe um
`schema.prisma` por dialeto em `tests/v3/adapters/prisma/schema/` e o client da
célula é gerado por `DQB_PRISMA_SCHEMA`. Os quatro são validados contra o mesmo
manifesto por `manifest-matches-schema.spec.ts`.

**Aviso de ambiente.** `better-sqlite3` é binário nativo: depois de trocar a
versão do Node (o `.nvmrc` pede a 24), `pnpm rebuild better-sqlite3` é
obrigatório, senão 8 suites falham com `NODE_MODULE_VERSION` incompatível — erro
que não tem nada a ver com o código e que a CI nunca mostra, porque lá o install
é sempre limpo.
