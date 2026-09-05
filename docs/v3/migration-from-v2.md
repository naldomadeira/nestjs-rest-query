# Migração v2 → v3

A v3 substitui a tradução independente de query em cada adapter por um núcleo
semântico único. A entrada HTTP vira uma AST tipada, validada contra um schema
lógico e autorizada por regras exatas; os adapters apenas compilam esse plano
para a API do ORM.

Isso torna a v3 **breaking em vários pontos observáveis**. Este guia lista cada
mudança com o antes e o depois.

> **Este é o guia de referência por tópico.** O caminho curto e ordenado, em
> inglês, está em [`MIGRATION.md`](../../MIGRATION.md), seção `2.x → 3.x` — é o
> arquivo que a mensagem de erro do `forRoot` nomeia. Os dois não divergem: lá
> ficam os passos na ordem em que se executam, aqui fica o detalhe de cada
> assunto. Onde o `MIGRATION.md` resume, ele linka para cá.

> **Estado desta versão.** A v3 é pré-release. O estado medido de cada célula
> ORM × banco, a cobertura e os gates que faltam para a `3.0.0` estável estão em
> [`status.md`](./status.md) — que é a única fonte desse número. A matriz
> **suportada** (versões e faixas de peer) está em
> [`versions.md`](./versions.md). Este guia não repete nenhum dos dois.

## Ordem de execução

Os números das seções são estáveis (são citados de fora); a ordem em que se
migra é esta:

1. Subir os peers — [§11](#11-peers-obrigatórios).
2. Trocar globs por listas explícitas, por causa do ESM —
   [§12](#12-esm-nestjstypeorm-12).
3. Ajustar o `forRoot` — [§1](#1-configuração-global).
4. Declarar o schema lógico e as regras — [§2](#2-schema-lógico-e-regras-de-endpoint).
5. Trocar a chamada do serviço pela source — [§3](#3-chamada-do-serviço).
6. Criar as colunas que a v3 exige (dobradas e de ordem portável) —
   [§13](#13-migrações-de-banco-que-a-v3-exige).
7. Conferir o que muda na resposta — [§4](#4-coerção-de-valores) a
   [§8](#8-erros).
8. Conferir o que **impede a aplicação de subir** —
   [§14](#14-armadilhas-que-impedem-a-aplicação-de-subir).

---

## 1. Configuração global

`forRoot` passa a configurar apenas políticas comuns. Não existe adapter
default implícito — quem determina o adapter é a source.

```ts
// v2
DynamicQueryBuilderModule.forRoot({
  adapter: new DrizzleAdapter(),
  operators: { allowed: ['eq', 'like'] },
  pagination: { defaultPerPage: 10, maxPerPage: 100 },
});

// v3
DynamicQueryBuilderModule.forRoot({
  pagination: { defaultPerPage: 20, maxPerPage: 100 },
  textProfile: 'portable-strict',
  consistency: 'eventual',
  logging: { enabled: true, level: 'info', redactValues: true },
});
```

`adapter` e `operators` passam a ser rejeitados na inicialização com
`SOURCE_CONFIGURATION_INVALID` e a mensagem
`forRoot no longer accepts "<chave>"; see the v2 to v3 migration guide`. A
restrição de operadores agora é **por campo**, declarada nas regras do endpoint.

O default de `defaultPerPage` mudou de `10` para `20`.

## 2. Schema lógico e regras de endpoint

`RulesConfig` **sai** — não foi renomeado, foi removido. As regras passam por
`defineQueryRules`, que devolve `CompiledQueryRules` e valida tudo na
construção: paths inexistentes, defaults fora de allowed, operadores
incompatíveis com o tipo e sort ambíguo falham ao subir a aplicação, não na
primeira requisição.

São duas declarações, e a separação é o ponto: o **schema** descreve o que o
model é; as **regras** descrevem o que aquele endpoint autoriza. O mesmo schema
serve a endpoints com autorizações diferentes.

```ts
// v2
const rules: RulesConfig<User> = {
  filters: ['id', 'name', 'company'],
  sorts: ['id', 'name'],
  fields: ['id', 'name', 'email', 'company'],
  includes: ['company'],
  search: ['name', 'email'],
};
```

```ts
// v3 — o caminho que os quatro exemplos usam
import { defineQueryRules, defineQuerySchema } from 'nestjs-rest-query';
import type { QuerySchema, SchemaRegistry } from 'nestjs-rest-query';

const userSchema: QuerySchema = defineQuerySchema({
  model: 'user',
  primaryKey: ['id'],
  fields: [
    { path: 'id', kind: 'integer', nullable: false, primaryKey: true },
    {
      path: 'name',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      foldedField: 'name_folded',
    },
    // A companheira dobrada tem de ser declarada, e tem de ser interna.
    {
      path: 'name_folded',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      internal: true,
    },
    { path: 'email', kind: 'string', nullable: false, primaryKey: false },
  ],
  relations: [
    { path: 'company', target: 'company', cardinality: 'one', nullable: true },
  ],
});

// O registry precisa conter **todo** model alcançável a partir do root.
const SCHEMAS: SchemaRegistry = new Map([
  ['user', userSchema],
  ['company', companySchema],
]);

const rules = defineQueryRules(SCHEMAS, 'user', {
  filters: [
    { path: 'id', operators: ['eq', 'in'] },
    { path: 'name', operators: ['eq', 'ilike'] },
    { path: 'company.name', operators: ['eq'] },
  ],
  sorts: ['id', 'name'],
  fields: {
    root: { allowed: ['id', 'name', 'email'], default: ['id', 'name'] },
    relations: {
      company: { allowed: ['id', 'name'], default: ['id', 'name'] },
    },
  },
  includes: ['company'],
  search: ['name'],
});
```

Exemplos completos e verdes: `apps/examples/01-starter-app/src/product/product.query.ts`
(root + uma relação `one`) e
`apps/examples/02-app-with-postgres/src/access-requests/access-requests.query.ts`
(relação `one`, coleção `many` e duas relações `one` dentro da coleção).

### Por que o schema é declarado, e não derivado

O subpath do TypeORM exporta `buildSchemaRegistry(repository)`, que deriva o
registry inteiro da metadata da entidade, percorrendo as relações
transitivamente. Ele resolve o problema — mas **exige um `Repository` vivo**, e
as regras normalmente são consumidas por `@ApiDynamicQuery(rules)`, um _method
decorator_ avaliado no carregamento da classe do controller, antes de o Nest
construir o container. Nesse ponto não existe `DataSource`, logo não existe
repositório.

Por isso o caminho padrão é declarar com `defineQuerySchema`, no módulo de
regras. `buildSchemaRegistry` é a alternativa para quem monta as regras dentro
de um provider (`useFactory`), abrindo mão do decorator e injetando as regras de
outro jeito. Ele aceita também `fieldKinds`, para sobrescrever o tipo lógico de
campos que o banco não sabe expressar (um `char(36)` que guarda UUID).

**`buildSchemaRegistry` existe apenas no subpath `nestjs-rest-query/typeorm`.**
Não há equivalente no Prisma (o generator a partir de `schema.prisma` é lacuna
declarada para a 3.1.0). No Drizzle o equivalente é `buildSourceSchema` — ver
[§2.3](#23-drizzle-buildsourceschema-e-o-mapeamento-da-source).

### 2.1. O que muda na whitelist

- **Paths são exatos.** Na v2, autorizar `company` também aceitava
  `company.<qualquer-campo>`. Na v3 é preciso declarar `company.name`
  explicitamente. Revise cada whitelist: a v2 pode estar expondo mais do que
  você pretendia.
- **Operadores são por campo.** Não existe mais lista global.
- **`fields.root` é obrigatório**, e toda relação em `includes` precisa de
  projeção declarada em `fields.relations`, com `default` não vazio — e o
  inverso também vale: projeção de relação que não está em `includes` é
  recusada. Na v2 `fields` era opcional.
- **`fields` deixou de restringir sort.** Na v2, definir `fields` restringia
  implicitamente os campos de `sort`. Na v3 as duas listas são independentes.
- **Wildcard** existe só na construção, na forma explícita `'company.*'`, tem de
  ser a **única** entrada do `allowed` daquela relação, e nunca é aceito vindo
  do cliente.

### 2.2. O que é conferido contra a source, e o que não é

Antes de executar, `QueryBuilderService` compara o schema **root** que você
declarou com o que o adapter deriva, e qualquer diferença é
`SOURCE_CONFIGURATION_INVALID`. O que é comparado:

- `model` e `primaryKey`;
- por campo declarado: `kind`, `nullable`, `primaryKey`, `foldedField`,
  `portableOrderField`, `internal`;
- por relação declarada: `target`, `cardinality`, `nullable`.

Só o schema **root** é conferido. Os schemas das relações no registry não são.

Duas consequências que custaram tempo nos exemplos TypeORM:

- **O nome do model é derivado, não escolhido.** A regra é
  `metadata.name.replace(/Entity$/, '').toLowerCase()`. `User` dá `user` por
  coincidência; `AccessRequestItem` dá `accessrequestitem` — não
  `access_request_item` nem `accessRequestItem`. Errar não falha na subida:
  falha na primeira requisição, com
  `Source model X does not match query rules model Y`.
- **A nulabilidade da relação tem de bater com a derivação**, que é
  `relation.isNullable || relation.isOneToMany`. Toda coleção `OneToMany` é
  `nullable: true`; um `ManyToOne` sobre FK `NOT NULL` é `nullable: false`.

No **Prisma** essa garantia **não existe**. `PrismaAdapter.describe()` devolve o
schema do manifesto tal e qual, então nada compara o seu schema lógico com o
`schema.prisma` nem com o banco: um campo com nome errado só falha na primeira
requisição que o tocar. "Metadado ausente falha fechado" vale para o TypeORM e
para o Drizzle (onde `buildSourceSchema` deriva do mesmo descritor que a source
usa), não para o Prisma.

### 2.3. Drizzle: `buildSourceSchema` e o mapeamento da source

O subpath `nestjs-rest-query/drizzle` exporta `buildSourceSchema(table, relations)`
— a mesma função que `drizzleSource` usa internamente para descrever a source.
Derivar dela elimina a classe de erro em que o schema das regras divergiria do
schema da source:

```ts
import { buildSourceSchema } from 'nestjs-rest-query/drizzle';

export const USER_SCHEMAS: SchemaRegistry = new Map([
  ['user', buildSourceSchema(usersTable, userRelations)],
  ['company', buildSourceSchema(companiesTable, {})],
  ['post', buildSourceSchema(postsTable, {})],
]);
```

A source em si mudou de forma. A v2 recebia colunas do Drizzle; a v3 recebe um
descritor lógico e nomes:

| v2                                     | v3                                                         |
| -------------------------------------- | ---------------------------------------------------------- |
| `source.db` = o `db` do Drizzle        | `drizzleDatabase({ client: db, dialect })`                 |
| `source.table` = um `pgTable`          | `createDrizzleTable({ name, model, columns })` (descritor) |
| `source.primaryKey` = uma coluna       | `columns[x].primaryKey: true`                              |
| `relations.x.table`                    | `relations.x.target` (outro descritor)                     |
| `relations.x.on: eq(a, b)`             | `relations.x.sourceColumn` + `.targetColumn`               |
| `relations.x.primaryKey` (obrigatório) | **removido**                                               |
| — (não existia)                        | `relations.x.nullable` (obrigatório)                       |
| — (não existia)                        | `relations['x.y']` para saltos profundos                   |

`sourceColumn`/`targetColumn` são as colunas da junção **na direção do path**, e
não a FK "de verdade": numa coleção (`posts`) o root entra com `id` e o alvo com
`userId`, o inverso de uma relação `one` (`company`).

**A chave lógica da coluna é o identificador SQL.** O compilador emite a chave
do objeto `columns` através de `sql.identifier(...)`; o campo `name` do
`DrizzleColumn` é declarado e **nunca lido**. Um descritor cuja chave difere do
nome físico compila, passa na conferência da source, sobe a aplicação e falha no
banco com `column "companyId" does not exist`. Mantenha chave e nome físico
iguais. O exemplo 03 adiciona uma asserção de inicialização contra
`getTableColumns(pgTable)` para transformar isso em erro de subida; é contorno
de lacuna da biblioteca, não o desenho pretendido.

### 2.4. Prisma: o manifesto escrito à mão

A v2 montava a `PrismaSource` inline, por requisição. A v3 pede três artefatos,
e não há ferramenta que os derive:

```ts
// v2
const source: PrismaSource = {
  prisma: this.prisma,
  model: 'user',
  primaryKeyField: 'id',
  relations: {
    company: { cardinality: 'one' },
    posts: { cardinality: 'many' },
  },
};
```

```ts
// v3, artefato 1 — o schema lógico de todos os models alcançáveis
// apps/examples/04-app-with-prisma/src/query/schemas.ts
export const APP_SCHEMAS: SchemaRegistry = new Map([
  ['company', companySchema],
  ['user', userSchema],
  ['post', postSchema],
]);

// v3, artefato 2 — o manifesto
// apps/examples/04-app-with-prisma/src/query/manifest.ts
import { createPrismaManifest } from 'nestjs-rest-query/prisma';

export const APP_MANIFEST: PrismaManifest = createPrismaManifest({
  // Decide o dialeto e, com ele, o escape de padrão — ver §5.
  provider: 'postgresql',
  registry: APP_SCHEMAS,
  // Liga cada model do registry à propriedade do client (`prisma.user`).
  models: {
    company: { delegate: 'company' },
    user: { delegate: 'user' },
    post: { delegate: 'post' },
  },
});

// v3, artefato 3 — as regras por endpoint (`defineQueryRules`), e a chamada
await this.queryBuilderService.execute(
  prismaSource({ client: this.prisma, model: 'user', manifest: APP_MANIFEST }),
  query,
  rules
);
```

`createPrismaManifest` valida o manifesto contra si mesmo na inicialização:
model sem entrada no registry ou sem `delegate` falha com
`SOURCE_CONFIGURATION_INVALID`. O que ele não valida está em
[§2.2](#22-o-que-é-conferido-contra-a-source-e-o-que-não-é).

O `path` de um campo no schema lógico do Prisma é o nome da **propriedade do
client**, não o da coluna: é ele que vai no `where`/`select`/`orderBy` que o
adapter monta. Com `@map("name_folded")` no `schema.prisma`, a API HTTP fica
camelCase e o banco segue o perfil certificado em snake_case.

O `client` que `prismaSource` recebe é o `PrismaClient` **gerado, direto**, sem
cast e sem objeto-ponte:

```ts
prismaSource({ client: this.prisma, model: 'user', manifest });
```

Vale dizer porque não era verdade antes da `3.0.0`: o campo era tipado
`Readonly<Record<string, PrismaDelegate>>`, e nenhum `PrismaClient` real
satisfazia esse tipo — classe não recebe index signature implícita em
TypeScript, só type alias recebe. Todo consumidor precisava de uma afirmação de
tipo, contra o gate "nenhum cast no uso público documentado" da §23. Quem
garante a forma agora é `prismaSource`: o delegate nomeado pelo manifesto é
validado na construção da source e falha com `SOURCE_CONFIGURATION_INVALID` se
faltar ou não for delegate. É checagem que nenhum tipo poderia fazer neste
ponto, porque o nome do delegate vem de dado, não de código.

## 3. Chamada do serviço

A source discriminada substitui o repositório solto. O adapter entra pelo
subpath, porque a raiz do pacote não carrega ORM nenhum.

```ts
// v2
await this.queryService.execute(repository, query, rules, (qb) => {
  qb.andWhere('user.tenantId = :tenant', { tenant });
});

// v3
import { typeormSource } from 'nestjs-rest-query/typeorm';

await this.queryService.execute(typeormSource(repository), query, rules, {
  // Hook comum a todos os adapters: tenant, soft delete, políticas internas.
  transformPlan: (plan) => plan,
  // Hook específico do adapter: recebe o SelectQueryBuilder tipado.
  customize: (qb) => {
    qb.andWhere('root.tenant_id = :tenant', { tenant });
  },
  customizeScope: 'both',
});
```

`customize` declara se afeta `data`, `count` ou ambos; o default seguro é
`both`. O callback é invocado **uma vez por query do escopo**, então um único
`andWhere` com `both` entra nas duas. Um escopo parcial gera warning
estruturado, porque o count pode passar a descrever uma pergunta diferente da
dos dados.

As três fábricas de source:

```ts
typeormSource(repository);
drizzleSource({ db, dialect, table, relations });
prismaSource({ client, model, manifest });
```

**Sobre o tipo da linha:** só `typeormSource<T>(repository)` é genérico no row,
e só nele `execute` infere o tipo da linha sem cast. `drizzleSource` e
`prismaSource` fixam o row em `object`, então um retorno v2 do tipo
`Promise<QueryResult<UserDto>>` não é reproduzível ali sem afirmação de tipo. O
que os exemplos 03 e 04 anotam é `Promise<NormalizedQueryResult<object>>`.

`QueryResult<T>` continua exportado da raiz e é estruturalmente idêntico a
`NormalizedQueryResult<T>`, então uma anotação v2 **continua compilando** sem
avisar que algo mudou. O nome canônico do que `execute` devolve é
`NormalizedQueryResult`.

No controller, as regras compiladas são a fonte única de autorização e de
documentação:

```ts
// v2
@ApiDynamicQuery<User>({ filters: ['username', 'email'], sorts: ['username'] })
async findAll(
  @Query() query: DynamicQueryDto,
  @QueryRules() rules: RulesConfig,
): Promise<QueryResult<User>> {}

// v3
@ApiDynamicQuery(userRules)
async findAll(
  @Query() query: DynamicQueryDto,
  @QueryRules() rules: CompiledQueryRules,
): Promise<NormalizedQueryResult<User>> {}
```

`@ApiDynamicQuery` deixou de ser genérico: manter o parâmetro de tipo dá
`TS2558: Expected 0 type arguments, but got 1`. `ApiPaginatedResponse`
sobreviveu com a mesma assinatura e o mesmo envelope.

## 4. Coerção de valores

**Esta é a mudança de comportamento mais provável de afetar dados existentes.**

A v2 coagia pelo formato textual: `coerceValue()` transformava `"430123"` em
número sem saber o tipo da coluna. A v3 coage sempre pelo tipo do campo.

| Entrada                              | v2                | v3                                    |
| ------------------------------------ | ----------------- | ------------------------------------- |
| `filter[document][eq]=00430123`      | `430123` (número) | `"00430123"` (string)                 |
| `filter[id][eq]=10abc`               | `10` (parseInt)   | `400 FILTER_VALUE_INVALID`            |
| `filter[id][eq]=4.2`                 | `4` (truncado)    | `400 FILTER_VALUE_INVALID`            |
| `filter[active][eq]=yes`             | `true`            | `400 FILTER_VALUE_INVALID`            |
| `filter[price][eq]=1.10`             | `1.1` (float)     | `"1.10"` (decimal exato)              |
| `filter[at][eq]=2026-01-02T03:04:05` | aceito            | `400 FILTER_VALUE_INVALID` (sem fuso) |
| `filter[at][eq]=2026-02-30`          | aceito            | `400 FILTER_VALUE_INVALID`            |

Não existe `coercion: 'legacy'`. Se a sua aplicação dependia de uma coerção
implícita do banco, o campo precisa ser mapeado com o tipo lógico correto — ou
o cliente precisa enviar o valor no formato do tipo.

## 5. Operadores e padrões

- `%`, `_` e `\` são **literais**. `filter[name][like]=100%` procura o texto
  `100%`, não um prefixo. A biblioteca escolhe e escapa o caractere de escape
  por dialeto.
- **Exceção, por provider, no adapter Prisma.** O Prisma não emite cláusula
  `ESCAPE` e o client tipado não permite fornecê-la, então só resta o escape
  default do dialeto:
  - `postgresql` e `mysql` têm `\` como default. O adapter escapa o valor e a
    literalidade **vale**, igual ao TypeORM e ao Drizzle. Medido no exemplo 04
    contra Prisma 7.8.0 + PostgreSQL: `filter[title][like]=100%` devolve só a
    linha que contém o texto `100%`, e `filter[title][like]=a_b` só a que contém
    `a_b`.
  - `sqlite` e `sqlserver` **não têm** escape default. Ali os cinco operadores
    de padrão (`like`, `notLike`, `ilike`, `notIlike` e `search`) são
    **recusados** com `400 CAPABILITY_UNAVAILABLE`, em vez de devolverem o
    conjunto errado de linhas. É decisão declarada
    ([ADR-001](../superpowers/specs/2026-09-04-v3-adr-001-matriz-e-escopo-da-3.0.0.md),
    emenda 2), registrada como não suportada em [`versions.md`](./versions.md).
- `ilike` e `notIlike` exigem um `foldedField` declarado no schema. Sob o perfil
  `portable-strict`, eles consultam essa coluna com comparação literal — sem
  `ILIKE`, sem `mode: 'insensitive'` e sem depender da collation do servidor. É
  o que permite o mesmo resultado no Prisma com MySQL e SQL Server.
- **Sua aplicação é responsável por preencher o folded field na escrita**, com
  o helper `foldText(value)` exportado pelo pacote. O custo disso em DDL e
  backfill está em [§13](#13-migrações-de-banco-que-a-v3-exige).
- `in=[]` passa a compilar para condição sempre falsa (zero linhas). A v2
  ignorava o filtro e retornava tudo.
- `notIn=[]` compila para condição sempre verdadeira.
- `between` exige exatamente dois valores.
- Ordem (`gt`, `gte`, `lt`, `lte`, `between`) sobre `uuid` ou `enum` exige um
  `portableOrderField`, porque esses tipos não ordenam igual nas três famílias
  de banco. **Essa checagem também vale para `sorts`, e para a PK** — ver
  [§14](#14-armadilhas-que-impedem-a-aplicação-de-subir), que é onde ela morde.

## 6. Projeção e shape do JSON

- `fields=company.name` exige `includes=company`. Seleção não inclui relação
  implicitamente.
- Sem `fields` na URL, valem os `default` configurados para root e para cada
  relação incluída.
- A PK é selecionada internamente para hidratação e paginação, mas **removida do
  JSON** se não fizer parte da projeção visível. Na v2 ela era sempre injetada.
- Relação `one` retorna objeto ou `null`; relação `many` retorna array,
  inclusive vazio.
- Relações profundas permanecem aninhadas: `company.owner`, nunca
  `company_owner`.
- `bigint` sai como string decimal, `decimal` como string, `date` como
  `YYYY-MM-DD`, `datetime` como ISO 8601 UTC e `binary` como base64 — os mesmos
  valores independentemente do driver.
- Campos marcados `internal: true` (colunas dobradas, colunas de ordem
  portável) nunca aparecem no JSON, nem são filtráveis, projetáveis ou
  ordenáveis.

## 7. Ordenação e paginação

- Sort duplicado com a mesma direção é deduplicado; com direções conflitantes
  gera `400 SORT_CONFLICT`. A v2 mantinha a última direção no TypeORM, a
  primeira no Drizzle e ambas no Prisma.
- A PK completa é anexada como desempate, inclusive quando não há sort na URL.
  É daí que vem a armadilha da PK `uuid` — ver [§14](#14-armadilhas-que-impedem-a-aplicação-de-subir).
- Sort direto por uma folha através de relação `many` é inválido, e a recusa
  acontece **na construção das regras**: `defineQueryRules` não aceita
  `sorts: ['posts.title']`. A v2 aceitava no TypeORM e devolvia uma linha
  arbitrária do join. Se o path não estiver na whitelist, a recusa vem antes
  ainda, como `400 FIELD_NOT_ALLOWED` (`sort path is not allowed: <path>`) — é
  esse o código pelo qual um cliente deve fazer branch, não a mensagem do
  adapter.
- `page` e `perPage` aceitam somente inteiros decimais completos e positivos.
  `?page=` (vazio) passa a ser erro, não default.
- `total` conta roots, não linhas de join.
- `lastPage` continua no mínimo `1`.

## 8. Erros

**Antes do envelope, a armadilha.** Parâmetro de query desconhecido virou
`400 QUERY_SYNTAX_UNKNOWN_PARAM`, com o nome da chave ofensora em `details`. A
v2 aceitava qualquer coisa que não reconhecesse; a v3 recusa. A gramática são
oito parâmetros e nada mais: `filter`, `sort`, `fields`, `includes`, `search`,
`page`, `perPage`, `paginate`.

É a mudança com maior chance de virar "funcionava na v2, dá 400 na v3", porque
o parâmetro extra em geral não vem do seu código: `?utm_source=` de link de
campanha, `?_=1699999999` de cache-buster de jQuery, `?lang=` que um middleware
seu acrescenta. Antes o endpoint devolvia a lista e descartava a chave calado.

Se o seu endpoint legitimamente tem parâmetros próprios, não entregue
`req.query` inteiro à biblioteca — passe só o subconjunto da gramática, que é o
que `@Query() query: DynamicQueryDto` já lhe dá quando a DTO é o tipo do
parâmetro.

A razão é a mesma dos paths exatos e da coerção por tipo declarado: o núcleo da
v3 não ignora entrada que não lhe foi perguntada (§5.6 do design). Filtro
descartado em silêncio é página de resultado silenciosamente errada.

As mensagens em string saem; o corpo passa a ser um envelope estável.

```jsonc
// v2
{ "statusCode": 400, "message": "Filter field(s) not allowed: secret. Allowed fields: id, name" }

// v3
{
  "statusCode": 400,
  "code": "FIELD_NOT_ALLOWED",
  "message": "filter path is not allowed: secret",
  "details": { "path": "secret", "scope": "filter", "allowed": ["id", "name"] }
}
```

Faça branch pelo `code`, não pela mensagem. `details` nunca carrega o valor
enviado pelo cliente.

Códigos: `QUERY_SYNTAX_INVALID`, `QUERY_SYNTAX_UNKNOWN_PARAM`,
`FIELD_NOT_ALLOWED`, `FIELD_NOT_FOUND`, `RELATION_NOT_FOUND`,
`OPERATOR_NOT_ALLOWED`, `OPERATOR_TYPE_MISMATCH`, `FILTER_VALUE_INVALID`,
`PAGINATION_INVALID`, `SORT_CONFLICT`, `CAPABILITY_UNAVAILABLE`,
`PORTABILITY_PROFILE_MISMATCH`, `SOURCE_CONFIGURATION_INVALID`,
`ADAPTER_CONTRACT_VIOLATION`.

O export `ErrorMessages` foi removido.

## 9. Empacotamento

O root não carrega mais nenhum peer de ORM nem exporta classes de adapter.

```ts
// v2
import {
  TypeOrmAdapter,
  DrizzleAdapter,
  PrismaAdapter,
} from 'nestjs-rest-query';

// v3
import { typeormSource } from 'nestjs-rest-query/typeorm';
```

`import { PrismaAdapter } from 'nestjs-rest-query'` passa a dar `TS2305`, e
`forRoot({ adapter })` passa a dar
`TS2353: 'adapter' does not exist in type 'QueryBuilderConfigV3'`.

O pacote publica ESM e CJS com declarations equivalentes, e cada subpath declara
apenas o seu peer.

## 10. Perfil certificado de banco

A paridade só é prometida sobre um perfil versionado: encoding Unicode,
collation binária/code-point nas colunas textuais portáveis, valores em NFC,
sessão e armazenamento em UTC, modo estrito e precisão decimal declarada. A DDL
de cada família vive em `test/profiles/`.

Uma aplicação pode usar outro perfil, mas só recebe o selo de paridade se
executar e passar o mesmo conformance kit. `checkPortabilityProfile` transforma
os fatos do catálogo em violações antes de a aplicação aceitar tráfego, e
`collectProfileFacts` existe para o consumidor medir o próprio banco.

**Nem toda ferramenta de migração consegue expressar o perfil.** O caso medido é
o `drizzle-kit`: `push`/`generate` não sabem emitir `COLLATE "C"`, então o
comando que a documentação v2 indicava cria um schema parecido e sutilmente
diferente do perfil — e collation é parte da promessa de portabilidade. Quando a
ferramenta não consegue, emita a DDL explicitamente: é o que o exemplo 03 faz em
`src/database/bootstrap.ts`. Com TypeORM, migrations escritas à mão
(`queryRunner.query(...)`) expressam o perfil sem problema; com Prisma, a saída
do exemplo 04 foi DDL SQL própria em vez de `prisma migrate`.

O estado desse gate (fatos fornecidos pelo chamador versus collector
certificado por banco) está em [`status.md`](./status.md).

## 11. Peers obrigatórios

As faixas estão em [`versions.md`](./versions.md). O que **quebra na subida**
está aqui.

### 11.1. TypeORM

Nada na API da biblioteca. `^0.3.26 || ^1.0.0` passam o corpus. O que quebra é o
ESM do `@nestjs/typeorm@12` — [§12](#12-esm-nestjstypeorm-12).

### 11.2. Drizzle `0.45.x` → `1.0.0-rc.*`

A faixa da v3 é `>=1.0.0-rc.4 <1.0.0`: **todo** consumidor v2 de Drizzle (que
estava em `0.45.x`) é obrigado a subir para uma RC. Quatro coisas quebram:

1. **`drizzle(client, { schema })` não existe mais.** A assinatura 1.x só aceita
   `drizzle({ client })`. O `{ schema }` servia à API relacional (`db.query.*`),
   que o adapter v3 não usa.
2. **`relations()` foi removido** do `drizzle-orm` (substituído por
   `defineRelations`). Sob a v3 a resposta certa é **apagar** essas
   declarações: relação passou a ser declarada no descritor lógico, por path
   pontuado ([§2.3](#23-drizzle-buildsourceschema-e-o-mapeamento-da-source)).
3. **`declaration: true` + TypeScript 6 + `drizzle-orm` 1.x = TS2883.** Os
   tipos que `pgTable()` e `drizzle()` inferem não são nomeáveis de fora do
   pacote. Uma aplicação não publica tipos: use `"declaration": false`.
   `skipLibCheck` **não** resolve isso — ele é necessário por outro motivo
   (`drizzle-orm@1.0.0-rc.4` emite erros nos próprios `.d.cts` sob TypeScript 6).
4. **`db.all()` só existe na família SQLite.** PostgreSQL, MySQL e SQL Server
   expõem `execute()`, e cada um devolve uma forma diferente. Qual método
   chamar sai do `dialect` que você declara em `drizzleDatabase()`, nunca de
   inspeção do objeto; declarar errado dá
   `Drizzle client for <dialeto> does not expose <método>()`.

### 11.3. Prisma 6 → 7

`^6.19.0` continua na faixa. Se você for para 7.x, são seis mudanças, nenhuma
opcional:

1. **`url` saiu do `datasource`.** Manter o schema v2 falha a geração com
   `P1012: The datasource property 'url' is no longer supported in schema files`.
   As URLs de CLI/Migrate vão para `prisma.config.ts`; o client recebe a conexão
   de um driver adapter.
2. **O generator mudou.** `provider = "prisma-client-js"` → `prisma-client`, com
   `output` e `moduleFormat` **obrigatórios**. E o client deixa de existir em
   `@prisma/client`: `import { PrismaClient } from '@prisma/client'` passa a dar
   `TS2305: Module '"@prisma/client"' has no exported member 'PrismaClient'`.
   Todo import do client muda de caminho.
3. **`new PrismaClient()` exige driver adapter.** Adicione o adapter do dialeto
   na mesma major do client (`@prisma/adapter-pg`) e o driver (`pg`), e passe
   `{ adapter: new PrismaPg({ connectionString }) }` ao construtor.
4. **O client gerado é TypeScript de verdade**, não `.d.ts`. Gerar fora do
   `rootDir` do build quebra o `nest build` com
   `TS6059: File '.../generated/prisma/client.ts' is not under rootDir`. Gere
   dentro de `src` (`output = "../src/generated/prisma"`).
5. **O runtime do Prisma 7 se carrega por `import()` dinâmico**, então qualquer
   runner Jest que o toque precisa de `NODE_OPTIONS=--experimental-vm-modules`.
   Atenção: a receita ESM dos exemplos 01–03 (`useESM: true` +
   `extensionsToTreatAsEsm`) **falha** contra o client gerado, com
   `ReferenceError: exports is not defined`. O que funciona é ts-jest em
   CommonJS **mais** a flag — ver
   `apps/examples/04-app-with-prisma/test/jest-e2e.json`.
6. **`.env` deixou de ser lido pelo Prisma** (consequência de 1): a aplicação
   passa a ter de carregar `dotenv` e validar `DATABASE_URL` ela mesma.

## 12. ESM (`@nestjs/typeorm` 12)

`@nestjs/typeorm@12` é `"type": "module"`, sem entrada CommonJS. Isso invalida os
globs baseados em `__dirname` que todo app NestJS + TypeORM tem:

```diff
- entities: [path.join(__dirname, '/../**/*.entity{.ts,.js}')],
- migrations: [path.join(__dirname, '/migrations/*{.ts,.js}')],
+ entities: [User, Company, AccessRequest],
+ migrations: MIGRATIONS, // array explícito e ordenado
```

`__dirname` não existe em ESM, então sob runtime ESM a aplicação sobe com **zero
entidades e zero migrations** — sem erro, só um schema vazio. Os quatro exemplos
tiveram de trocar por listas explícitas; ver
`apps/examples/02-app-with-postgres/src/database/database.module.ts` e
`migrations.list.ts`. Listar tem um segundo efeito, melhor: uma entidade
renomeada passa a quebrar o build, e não a inicialização.

## 13. Migrações de banco que a v3 exige

Isto é DDL, não configuração. Duas famílias novas de coluna, as duas
preenchidas pela sua aplicação.

### 13.1. Colunas dobradas (`foldedField`)

Checklist, na ordem:

1. **Adicionar uma coluna por campo buscável.** Uma migration de schema, com
   `NOT NULL DEFAULT ''` para que ela nunca fique nula, venha a escrita da API,
   de um seed ou de um script avulso.
2. **Fazer backfill** das linhas existentes.
3. **Decidir o índice.** `like` e `search` compilam para `contains`, isto é
   `LIKE '%termo%'`, e um índice b-tree comum não acelera padrão não ancorado —
   nem antes nem depois da dobra. O que a coluna dobrada muda é que a
   comparação passa a ser um `LIKE` literal sobre valor normalizado em vez de
   `ILIKE`, então um índice comum **passa a servir** aos padrões ancorados
   (`termo%`). Para busca por substring o caminho é índice de trigrama ou
   full-text do seu banco — não medido aqui. O exemplo 02 cria índices simples
   sobre as colunas dobradas; trate isso como ponto de partida, não como
   receita medida.
4. **Mudar todo caminho de escrita** para gravar o valor dobrado junto, com
   `foldText(value)`. É literalmente a mesma função que o núcleo aplica ao termo
   da busca, e é isso que faz gravação e consulta concordarem. O exemplo 02 usa
   listeners `@BeforeInsert`/`@BeforeUpdate` na entidade.
5. **Declarar a companheira `internal: true`** no schema lógico. É obrigatório:
   `defineQuerySchema` recusa com
   `The folded field <path> of <model> must be declared internal`.

**O nome da coluna.** No adapter do **TypeORM** é convenção, não escolha: o
resolver reconhece a companheira como `<path do campo>_folded`, sobre o nome da
**propriedade da entidade**, não sobre o nome físico. Para `firstName` mapeado
em `first_name`, a propriedade tem de se chamar `firstName_folded` (a coluna
física pode continuar `first_name_folded`). Errar produz
`SOURCE_CONFIGURATION_INVALID`, não um aviso. O mesmo resolver marca como
interna toda propriedade terminada em `_folded`. No **Drizzle** e no **Prisma** o
schema é declarado em vez de derivado, então qualquer nome serve desde que a
declaração e a coluna física concordem (os exemplos usam `nameFolded`).

**Sem a coluna, os operadores não existem.** `defineQueryRules` recusa
`search` num path sem `foldedField` (`Search field <path> declares no folded
field`) e `ilike`/`notIlike` do mesmo jeito
(`Field <path> declares no folded field for ilike`). A aplicação não sobe.

**O que a dobra não faz.** `foldText` é `NFC` + `toLowerCase`, **sem remoção de
diacrítico**. Então `?search=eletrica` **não** acha "Elétrica". O que a busca
promete é apenas que a _caixa_ do termo não muda o conjunto de linhas. Um
consumidor v2 acostumado a `ILIKE '%eletrica%'` sob collation acento-insensível
vai ver isso como regressão — e é, do ponto de vista dele: se precisar de
insensibilidade a acento, isso passa a ser uma coluna própria, normalizada pela
sua aplicação.

### 13.2. Colunas de ordem portável (`portableOrderField`)

`uuid` e `enum` não têm ordem total idêntica nas três famílias de banco, então a
v3 não ordena por eles: ordena por uma coluna que você declara. Os kinds que já
têm ordem total portável — `string`, `integer`, `bigint`, `decimal`, `boolean`,
`date`, `datetime` — não precisam de nada.

O custo é o mesmo do item anterior: coluna nova, backfill, preenchimento na
escrita e `internal: true`. No TypeORM a convenção é o sufixo `_order` sobre o
path do campo (`<path>_order`), também auto-marcado interno pelo resolver. Nos
exemplos: `posts.id_order` no 04 (Prisma) e `idOrder` no 03 (Drizzle).

Quando ela é obrigatória está em [§14](#14-armadilhas-que-impedem-a-aplicação-de-subir).

## 14. Armadilhas que impedem a aplicação de subir

Nenhuma é exótica; as três saíram da migração dos exemplos.

**Uma whitelist `sorts` v2 sobre `enum` ou `uuid` passa a ser fatal na subida.**
`defineQueryRules` roda a checagem de ordem portável em **todo** path de
`sorts`, não só em filtro de ordem. Uma linha v2 perfeitamente comum —

```ts
sorts: ['name', 'slug', 'status', 'createdAt']; // status é enum
```

— falha no carregamento do módulo, com
`SOURCE_CONFIGURATION_INVALID: sorts.status: Field status has no portable total
order`. Ou o path sai de `sorts` (foi o que
`apps/examples/02-app-with-postgres/src/modules/modules.query.ts` fez), ou você
cria a coluna de ordem portável para ele.

**PK `uuid` exige `portableOrderField` em toda requisição.** O desempate de
paginação é sempre anexado sobre a PK completa, inclusive quando não há `sort`
na URL. Então com PK `uuid` e sem coluna de ordem, um `GET /posts` pelado morre
na construção do plano:

```
CAPABILITY_UNAVAILABLE: Primary key part id of post has no portable total order
```

Isso atinge quase todo consumidor de Prisma, porque `@id @default(uuid())` é o
default idiomático do Prisma, e todo consumidor de Drizzle com PK `uuid`. Ler a
frase da [§5](#5-operadores-e-padrões) como "só afeta quem filtra por ordem em
UUID" é o erro: o caso comum é este.

**`sorts` através de coleção também falha na construção**, com
`Sort <path> crosses a many relation, which has no deterministic order`.

**O schema declarado é conferido campo a campo contra a source** —
[§2.2](#22-o-que-é-conferido-contra-a-source-e-o-que-não-é).

## 15. `search` através de relação

Alvo de `search` que atravessa relação compila como `EXISTS` correlacionado,
igual a um filtro no mesmo path: a página mantém o tamanho pedido e o `total`
continua contando roots. Um salto ou vários, coleção ou many-to-many — sua
whitelist v2 pode manter esses paths.

Vale a nota histórica, porque um consumidor v2 pode ter esbarrado nas duas
metades disto. Até a `3.0.0`, alvo que cruzava uma relação `many` virava junção
de predicado, que duplicava linhas do root antes do `LIMIT` e devolvia página
curta **em silêncio** — medido no exemplo 02 contra PostgreSQL, com `perPage=5`
voltando 4 linhas para 24 roots que casavam. A causa estava no plano:
`PlanFilter` carregava a marca `existential` e `PlanSearch.targets` não
carregava nenhuma, então Prisma e Drizzle acertavam por derivar a cardinalidade
sozinhos e o TypeORM, que confia no plano, errava. E path que cruzasse **mais de
uma** relação, ou uma many-to-many, era recusado pelo adapter TypeORM enquanto
os outros dois compilavam.

As duas estão fechadas, e o exemplo 02 voltou a declarar
`search: ['user.firstName', 'items.company.name']` — um salto `one` e uma cadeia
de duas relações no mesmo `OR` —, com o smoke E2E afirmando o tamanho da página.
No corpus, `search/through-many-is-existential` e
`relation-many/chain-through-one-is-existential` travam a convergência dos três
adapters, e as nove células da matriz as executam em PostgreSQL, MySQL e SQL
Server.

A regra que ainda restringe a whitelist é outra: **todo alvo de `search` exige
coluna dobrada, inclusive através de relação.** Foi por isso que
`items.company.cnpj` ficou fora do exemplo 02 — sem `cnpj_folded`, declará-lo
derruba a subida, não a requisição. Buscar por documento segue possível pelo
caminho certo: `filter[cnpj][like]`.

## Diferenças em relação ao design aprovado

O design (`../superpowers/specs/2026-09-03-v3-paridade-orm-bancos-design.md`)
lista `normalize()` no contrato do adapter (§15). A implementação o mantém
**fora**: cada adapter hidrata e devolve `AdapterResult`, e a normalização
canônica é do núcleo, comum aos três. Manter `normalize()` no adapter permitiria
três serializações divergentes para o mesmo tipo lógico — exatamente o que a
§5.4 proíbe.

Dois casos do corpus foram reescritos por serem inalcançáveis como especificados:

- A ausência de `portableOrderField` num campo autorizado para ordem falha na
  construção das regras, não em runtime — não existe requisição HTTP que a
  alcance. O corpus cobre o caminho observável (a ordem sai pela coluna
  portável) e o fail-closed vive nos unitários.
- Um operador não-`isNull` aplicado a uma relação produz `OPERATOR_NOT_ALLOWED`,
  não `OPERATOR_TYPE_MISMATCH`: autorização precede a validação de tipo, e as
  regras não conseguem declarar outro operador para uma relação.
