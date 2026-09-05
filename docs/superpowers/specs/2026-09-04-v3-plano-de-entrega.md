# Plano de entrega da v3 — de três PRs abertos até a `3.0.0`

> **Status:** Aprovado em 2026-09-04.
> **Owner:** Opus.
> **Decide:** como as fases 6 e 7 do
> [design](./2026-09-03-v3-paridade-orm-bancos-design.md) são entregues.
> **Depende de:** [ADR-001](./2026-09-04-v3-adr-001-matriz-e-escopo-da-3.0.0.md).

Registro de decisão, com data no nome: não deve ser editado para refletir
progresso. O estado atual vive em [`../../v3/status.md`](../../v3/status.md).

---

## O que já está pronto e não foi medido aqui

Três PRs empilhados, nenhum aterrissado, `main` sem divergência — o stack é
limpo e não exige rebase:

| PR  | Branch                       | commits | contém                              |
| --- | ---------------------------- | ------- | ----------------------------------- |
| 1   | `feat/v3-core-typeorm`       | 35      | núcleo + TypeORM                    |
| 2   | `feat/v3-prisma-drizzle`     | 43      | PR1 + adapters Prisma e Drizzle     |
| 3   | `feat/v3-reference-dialects` | 53      | PR2 + corpus contra ORM real + docs |

Medido em 2026-09-04 (Node v20.19.4): `typecheck`, `lint` e `test` passam — 42
suites, **656** testes, zero skips; cobertura total **95.31% / 87.71%**.

## Sequência

### PR 1 → 2 → 3: aterrissar o stack

Merge sequencial, retargetando a base conforme cada um entra. Sem rebase: nada
foi publicado, então mudar a assinatura de `drizzleDatabase()` mais tarde não
quebra consumidor nenhum, e rebasear arrastaria 53 commits para refazer review.

**Única mudança antes do merge do PR3** — corrigir `docs/v3/status.md`, que
carrega quatro afirmações falsas. Um documento cujo propósito declarado é ser a
verdade sobre o estado não deve entrar no `main` errado:

| Afirmação no `status.md`                                               | Realidade medida                                                                                                     |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Bloqueador nº4: "Drizzle 1.x em RC … sem GA com suporte a MSSQL"       | O suporte a MSSQL existe desde o `rc.4` (`node-mssql/`). Falta o GA, não o MSSQL.                                    |
| Bloqueador nº7: "collector de perfil certificado por banco não existe" | Existe, em `tests/v3/integration/setup.ts:108`, com queries reais de catálogo. Está em código de teste, não ausente. |
| "TypeORM: harness pronto, matriz não confirmada"                       | A célula TypeORM × MySQL rodou verde (`integration.xml`, 66/66, 2026-09-04).                                         |
| "42 suites, 654 testes" e cobertura "95.26% / 87.62%"                  | 656 testes; 95.31% / 87.71%.                                                                                         |

E **acrescentar o bloqueador que faltava**, que é o mais sério de todos: o
adapter Drizzle não executa em nenhum banco real (ver PR4a).

**Critério de saída:** os três mergeados, `main` verde na CI, `status.md`
descrevendo o estado real.

### PR4a — habilitadores

Tudo aqui é verificável no dialeto de referência, sem subir container. É o que
torna as nove células _possíveis_; provar que elas passam é do PR4b. Separar as
duas coisas é o que dá diagnóstico: se a matriz vier vermelha num PR único, não
se sabe se o erro é do habilitador ou da célula.

1. **Executor do Drizzle.** `drizzleDatabase({ client, dialect })`. O
   `client.all()` de hoje é exclusivo do SQLite — o guard em
   `drizzle-database.ts:165` lança para Postgres, MySQL e SQL Server. O dialeto
   explícito escolhe método e normalização, e mata o
   `as unknown as DrizzleClientLike` de `tests/v3/adapters/drizzle/helpers.ts:45`
   — o cast que impediu o compilador de acusar o problema. Formas de retorno a
   normalizar, medidas em runtime:

   | dialeto                    | método    | retorno                |
   | -------------------------- | --------- | ---------------------- |
   | sqlite (`better-sqlite3`)  | `all`     | `Row[]`                |
   | postgres (`node-postgres`) | `execute` | `{ rows }`             |
   | postgres (`postgres-js`)   | `execute` | já é `Row[]`           |
   | mysql (`mysql2`)           | `execute` | tupla `[rows, fields]` |
   | mssql (`node-mssql`)       | `execute` | `{ recordset }`        |

2. **Collector de perfil em `src/`.** Promover `collectFacts` de
   `tests/v3/integration/setup.ts:108` para `src/`, um por adapter, exposto na
   inicialização. Hoje o `PORTABILITY_PROFILE_MISMATCH` depende de o chamador
   informar fatos honestos — basta mentir para passar. `profile-check.ts:8` já
   diz qual é o lugar certo: "quem lê o catálogo é o adapter". Também elimina a
   duplicação que o PR4b criaria ao precisar do mesmo collector para Prisma e
   Drizzle.
3. **Padrões do Prisma: nativo onde dá, recusa alta onde não dá.** `\` nativo
   em Postgres e MySQL; em SQLite e SQL Server — que não têm escape default no
   `LIKE`, medido — os cinco operadores de padrão são recusados com
   `CAPABILITY_UNAVAILABLE`. Corrigir o comentário factualmente errado em
   `prisma-filter.compiler.ts:96` ("`contains` do Prisma é literal") e o
   `escapeCharacter: '!'` de `prisma.adapter.ts:62`, que o adapter nunca honra.
   Ver ADR-001, emenda 2, para as duas medições que descartaram o `$queryRaw`.
4. **`patternEscape: 'clause' | 'native' | 'unsupported'`** em
   `AdapterCapabilities`, com `escapeCharacter` vazio no caso `unsupported` e
   contract test verificando a equivalência. Uma capability que não descreve o
   comportamento real foi exatamente como a divergência do `like` passou.
5. **Validador do manifesto Prisma** contra o `schema.prisma`, falhando no
   build quando divergirem.
6. **Peer do Drizzle** de `>=1.0.0-rc.4 <2.0.0` para `>=1.0.0-rc.4 <1.0.0`.
7. **Alinhar a versão de Node.** `.nvmrc` pina `v20.19.4`, `engines.node` pede
   `>=22`, a CI roda `[22, 24]` e o §6.1 elege 24 como alvo. Os 656 testes
   verdes foram medidos numa versão que o pacote declara não suportar.
8. **Typecheck de `tests/**`** — item não previsto, descoberto na execução.
`pnpm typecheck`usa`tsconfig.build.json`, que inclui só `src/**`, e o
`ts-jest`roda transpile-only por causa do`isolatedModules`: **erro de tipo
   em teste não era pego por gate nenhum**, e um passou de fato. Nasce
   `pnpm typecheck:tests` mais um passo na CI. É também o único gate que carrega
   `tests/v3/integration/**`, que o `pnpm test`ignora por`testPathIgnorePatterns`.

**Critério de saída:** corpus verde no dialeto de referência para os três
adapters, `patternEscape` coberto por contract test, e o cast removido do
harness sem `@ts-expect-error` no lugar.

### PR4b — a matriz real (fase 6)

1. **Harness parametrizado.** `DQB_ADAPTER=typeorm|prisma|drizzle` cruzado com
   `DQB_DIALECT`, num spec único que despacha a source.
   `corpus-database.spec.ts:37` está preso em `typeormSource`, e
   `runCorpusCase` já é source-agnostic — o que nasce é a abertura de conexão
   por adapter. Um spec só mantém `assert-no-skips` binário, sem exceções.
2. **CI.** No PR, uma célula por ORM (Postgres, alvo principal §6.1). No push
   para `main` e na tag de release, as nove com `fail-fast: false` e
   `assert-no-skips`. O §6.2 diz que célula vermelha bloqueia _release_, não PR.
3. **Tabela pública de versões** em `docs/v3/`, mais um teste que a compara com
   o YAML do workflow — o gate "matriz pública coincide com a CI" não tem hoje
   tabela alguma para coincidir. Comparar em vez de gerar: uma tabela que
   ninguém escreveu é uma tabela que ninguém lê.

**Critério de saída:** nove células verdes, sem skip, com `assert-no-skips`
passando em todas.

**Risco declarado:** que o `contains` do Prisma 7 preserve o `\` sob bind
param, nas células Postgres e MySQL, é a última afirmação deste plano que
nenhuma medição sustenta. Que os dois bancos tratem `\` como escape default do
`LIKE` é documentado, e o perfil de MySQL usa `STRICT_ALL_TABLES` sem
`NO_BACKSLASH_ESCAPES` — mas o caminho do bind param pelo client do Prisma só a
célula real prova. Se refutar, as duas células caem para
`patternEscape: 'unsupported'` como SQLite e SQL Server, e o Prisma passa a não
oferecer operador de padrão em dialeto nenhum — o que torna a lacuna grande
demais para a `3.0.0` e reabre a emenda 2.

### PR5 — fase 7

1. **Os quatro exemplos reescritos para a v3**, com smoke E2E na CI. Todos usam
   a API v2 (`DynamicQueryBuilderModule`, `PrismaAdapter` importado da raiz).
   Como consomem `workspace:*`, são hoje o único teste de que a API pública é
   usável de fora sem cast — e são domínios distintos, sem duplicação a cortar.
2. **`MIGRATION.md` validado num consumidor v2 real.** Sem codemod: o gate pede
   o guia validado, e um codemod não validado é pior que nenhum.
3. **Cobertura de branches: TypeORM de 75% para 95%, Drizzle de 94.6% para
   95%.** O TypeORM é o adapter de referência, e 25% dos seus branches nunca
   executaram — PK composta, paginação em duas fases, joins idempotentes. O
   Drizzle está a 0.41pp do gate por dívida pré-existente, e cobrir
   `drizzle-projection.compiler.ts` sozinho já limpa. Unit tests nos compilers;
   caso novo no corpus só quando o branch muda resultado observável, para não
   inflar as nove células.

   **`src/contracts` é inverificável por construção.** O
   `coveragePathIgnorePatterns` exclui `index.ts$` e `.interface.ts$`, e os 9
   arquivos de `src/contracts` são exclusivamente esses dois padrões — então
   nenhum teste move a agulha ali, e "95% em contracts" nunca é atingido nem
   reprovado, só ausente. Decidir entre mudar o alvo do gate ou abrir exceção
   no ignore pattern; deixar como está é o pior dos três, porque parece medido.

   **Antes de adicionar `coverageThreshold`,** semear o `fast-check`: a
   cobertura oscila entre execuções com a mesma contagem de testes
   (`validate-pagination.ts` variou 91.17% ↔ 97.05%), o que hoje não trava nada
   porque não há threshold — e travaria de forma intermitente no dia em que
   houver.

4. **Furo do corpus: `notIn` não vazio nunca é compilado.** O corpus só tem
   `notIn=[]`, que é sempre-verdadeiro e é elidido do `AND`, então o caminho de
   `NOT IN` com valores não é exercitado em **nenhum** dos três adapters. É
   lacuna de cobertura semântica, não de linha: um caso novo no corpus cobre os
   três de uma vez, e por isso vale mais que qualquer unit test aqui.
5. **Datar bench e segurança no `status.md`.** `budget.spec.ts` já mede o
   orçamento do §18.4 (núcleo, sem I/O) e roda em `pnpm test`; CodeQL e
   Scorecard já rodam na CI. Falta uma data, não trabalho. Benchmark com I/O
   mediria a latência do banco, não da biblioteca.
6. **Os 15 erros de lint fora do escopo do `pnpm lint`.** O script cobre
   `src/**/*.ts`; existem 15 achados reais em `apps/docs/**` e `tests/**`. Como
   o PR5 mexe em exemplos e testes, é onde eles cabem.

**Critério de saída:** os quatro exemplos compilam e passam smoke E2E; o guia
de migração foi exercido num projeto v2 de verdade; branches do TypeORM acima
de 95%.

## Emenda 1 (2026-09-04): cadeia existencial de mais de um salto no TypeORM — **implementada em 2026-09-04**

Achado na execução do PR5, ao migrar o exemplo 02: a whitelist v2 dele
declarava `search: ['items.company.name', 'items.company.cnpj']`, e os dois
paths cruzam **duas** relações (`items`, que é `many`, e depois `company`).

Medido nos três adapters:

| adapter | `posts.author.name` (many → one)                     | `posts.tags.label` (many → many) |
| ------- | ---------------------------------------------------- | -------------------------------- |
| Prisma  | `{posts:{some:{author:{is:…}}}}` — compila           | compila                          |
| Drizzle | join encadeado dentro de um único `EXISTS` — compila | compila                          |
| TypeORM | `CAPABILITY_UNAVAILABLE`                             | `CAPABILITY_UNAVAILABLE`         |

O guard está em `typeorm-filter.compiler.ts`, `existsThroughMany`, e recusa
`relationPath.length !== 1`; a relação many-to-many é recusada por guard
próprio, que substituiu um caminho que emitia SQL válido contra a **tabela
errada**, em silêncio. Vale para filtro **e** para busca — não é regressão do
PR5, é limite pré-existente que o PR5 tornou visível.

**Não é violação da §5**, e é por isso que não bloqueia a `3.0.0`: a §5 define
paridade sobre as queries do corpus, nenhum caso do corpus cruza mais de uma
relação existencialmente, o §411 promete semântica existencial para "dotted path
por relação `many`" — um salto, que os três cumprem —, e a recusa é alta, com
código estável, nunca resultado aproximado.

**Decisão (do owner, 2026-09-04): implementar no adapter TypeORM, junto com o
many-to-many, e não agora.** Fica pendência para depois desta entrega, com o
limite declarado em `docs/v3/status.md` e em `docs/v3/versions.md` enquanto não
for fechado. O que a implementação exige: joins encadeados dentro da subquery
`EXISTS` (a forma que o Drizzle já usa), travessia da tabela de junção para
m2m, caso de corpus cobrindo as duas formas, e nova rodada das nove células.

### Fechamento (2026-09-04): implementada

A decisão foi executada no mesmo dia em que foi tomada. `existsThroughMany`
não recusa mais profundidade nenhuma, e a linha do TypeORM na tabela acima
passa a ser a mesma das outras duas: **um único `EXISTS`, correlacionado com o
root uma só vez, com cada salto seguinte como `INNER JOIN` dentro da
subconsulta**. Correlacionar por fora foi rejeitado pela mesma aritmética de
sempre — traria a coleção para o `FROM` externo, inflaria os roots e a §14
perderia o `total`.

O que ficou provado, e onde:

| forma                                           | SQL que passa a sair                                                                                                                                                                                                            | prova                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| many → one (`posts.author.name`)                | `EXISTS (SELECT 1 FROM posts dqb_ex_posts INNER JOIN users dqb_ex_posts_author ON dqb_ex_posts_author.id = dqb_ex_posts.user_id WHERE dqb_ex_posts.user_id = root.id AND dqb_ex_posts_author.name = :dqb_0)`                    | `contract-guards.spec.ts`, corpus                      |
| many → many, duas coleções (`posts.tags.label`) | `EXISTS (SELECT 1 FROM posts dqb_ex_posts INNER JOIN tags dqb_ex_posts_tags ON dqb_ex_posts_tags.post_id = dqb_ex_posts.id WHERE dqb_ex_posts.user_id = root.id AND dqb_ex_posts_tags.label = :dqb_0)`                          | `contract-guards.spec.ts`, corpus                      |
| many-to-many com junção (`labels.name`)         | `EXISTS (SELECT 1 FROM "articles_labels_labels" dqb_ex_labels_j INNER JOIN labels dqb_ex_labels ON dqb_ex_labels.id = dqb_ex_labels_j."labelsId" WHERE dqb_ex_labels_j."articlesId" = root.id AND dqb_ex_labels.name = :dqb_0)` | `existential-compiler.spec.ts`, SQL **e** linhas reais |
| FK composta em cadeia (`entries.ledger.title`)  | correlação e `ON` com **duas** colunas cada                                                                                                                                                                                     | `existential-compiler.spec.ts`                         |

A many-to-many é a parte que exigia mais que "aceitar profundidade": o `FROM`
da subconsulta é a **tabela de junção**, e o alvo só é alcançado por join a
partir dela. O guard antigo existia porque o código anterior a essa recusa
emitia `EXISTS` contra a tabela da entidade que _declara_ a relação — SQL
válido, tabela errada, resultado errado em silêncio. Os testes travam as duas
direções (lado dono e lado inverso, que não guarda a junção e a alcança pelo
dono) e não só a forma do SQL: o fixture local tem um artigo com dois rótulos
e um artigo sem rótulo nenhum, e a consulta real devolve um root por artigo
ligado — nunca o artigo sem junção, nunca o artigo duplicado.

Os identificadores da junção passaram a ser citados pelo `escape` do driver.
São os únicos nomes do SQL que **não** vêm do consumidor: a estratégia de
nomes do TypeORM os gera em camelCase (`articlesId`), e sem aspas o PostgreSQL
os dobraria para minúsculas. O resto do compilador continua emitindo
identificadores crus — uniformizar a citação é decisão maior que esta emenda, e
fica declarada aqui como dívida, não como resolvida.

**Status HTTP:** as duas recusas com `CAPABILITY_UNAVAILABLE` (500, disparadas
por path de cliente) deixaram de existir — o defeito da §17 foi resolvido por
remoção, não por reclassificação. Sobram no `typeorm-filter.compiler.ts` dois
`ADAPTER_CONTRACT_VIOLATION`, que continuam 500 porque só disparam se plano e
plano de joins divergirem: invariante interna do adapter, nunca condição do
cliente. O adapter TypeORM não tem mais nenhum `CAPABILITY_UNAVAILABLE`.

**Corpus:** 71 → **74 casos** (`relation-many/chain-through-one-is-existential`,
`chain-through-two-collections` e `chain-through-two-collections-deduplicates`),
os três verdes nos **três** adapters no dialeto de referência, sem divergência
declarada. O preset `user.deep` ganhou `posts.author.name` e `posts.tags.label`
na whitelist. **Custo a pagar: as nove células da matriz precisam de nova
rodada** — e `docs/v3/status.md`, `docs/v3/versions.md`, `docs/v3/migration-from-v2.md`
e `MIGRATION.md` ainda anunciam o limite como aberto e a contagem de 71.

## Releases

`3.0.0-alpha.1` assim que o PR4b fechar as nove células → `3.0.0-rc.1` após o
PR5 → `3.0.0`.

O alpha não é cerimônia: dois gates da §23 — build em consumidor isolado e guia
de migração validado num projeto v2 real — só podem ser provados por alguém de
fora. Pular o alpha significa descobri-los num rc. Beta não agrega nada entre
os dois: o alpha valida o consumidor, o rc congela a superfície.

## O que sobra de dependência externa

Uma: `drizzle-orm` 1.x é RC, e a `3.0.0` estável sai com um peer de
pré-release. É deliberado, e está contido pela faixa fechada `<1.0.0` — quando
o GA sair, ele exige uma release nossa que reexecutou a matriz. Ver ADR-001,
"Risco aceito, declarado".

Todo o resto é trabalho, não espera.
