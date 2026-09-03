# nestjs-rest-query v3 — Design de paridade entre ORMs e bancos

- **Status:** aprovado para planejamento em 2026-09-03
- **Versão-alvo:** `3.0.0`
- **Escopo:** TypeORM, Prisma e Drizzle sobre PostgreSQL, MySQL e SQL Server

## 1. Resumo executivo

A versão 3 substituirá a tradução independente de query em cada adapter por um
núcleo semântico único. O núcleo transformará a entrada HTTP em uma AST tipada,
validada contra um schema lógico e autorizada por regras exatas. Os adapters
apenas resolverão metadados, compilarão a AST para a API do ORM e normalizarão o
resultado.

A definição de paridade será observável: para a mesma query, regras, schema e
seed, as nove combinações de ORM e banco deverão produzir o mesmo status, código
de erro, conjunto e ordem de IDs, paginação, shape e valores JSON. SQL gerado não
faz parte do contrato desde que preserve esse resultado e os requisitos de
segurança e desempenho.

A `3.0.0` estável somente poderá ser publicada quando o Drizzle 1.x com MSSQL
estiver estável e a matriz completa estiver verde sem skips. Enquanto o suporte
necessário estiver em RC, a biblioteca também permanecerá em pré-release.

## 2. Contexto e evidências da auditoria

O repositório está organizado em contratos, domínio, core, adapters, exemplos e
documentação. A base de testes atual é útil para regressões locais, mas não mede
o comportamento real prometido ao consumidor.

### 2.1 Baseline verificado

- Versão atual: `2.1.0`.
- `22` suites e `497` testes passam.
- Build do pacote, lint, formatação e build da documentação passam.
- A matriz em `tests/parity/` usa fixtures e delegates falsos; nenhum banco é
  consultado.
- Não existem specs dentro de `apps/examples/`.
- Os quatro exemplos falham no build atual. Os problemas incluem configuração
  incompatível com TypeScript 6, dependência ausente no starter e Prisma Client
  não gerado/fora de sincronia com a CLI.
- O entrypoint raiz carrega o barrel de todos os adapters; por isso o peer
  Drizzle declarado como opcional é requerido em runtime ao importar o pacote.
- A API pública de `QueryBuilderService` continua tipada com `Repository` e
  `SelectQueryBuilder` do TypeORM. Drizzle e Prisma exigem casts.

### 2.2 Falhas comportamentais confirmadas

| Severidade | Falha                                                   | Evidência                                                                     |
| ---------- | ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Crítica    | Coerção orientada pelo formato textual                  | `coerceValue()` converte `"430123"` para número sem conhecer a coluna.        |
| Crítica    | Drizzle + MySQL gera SQL inválido                       | `ilike()` compilou para `` `users`.`name` ilike ? `` no dialeto MySQL.        |
| Crítica    | Prisma usa `mode: 'insensitive'` sem provider awareness | MySQL e SQL Server não expõem essa propriedade no client gerado.              |
| Crítica    | Não há suporte MSSQL no Drizzle usado pelo projeto      | O peer atual é `^0.45.0`; MSSQL exige a linha Drizzle 1.x.                    |
| Alta       | Filtro TypeORM por relação não cria join                | `filter[category.name]` sem `includes=category` falhou com alias inexistente. |
| Alta       | `fields + includes` perde a relação no TypeORM          | A consulta executou, mas retornou apenas campos root.                         |
| Alta       | Whitelist de relação abre caminhos implicitamente       | Autorizar `company` também aceita `company.<qualquer-campo>`.                 |
| Alta       | A paridade mede montagem, não semântica                 | O corpus atual não compara rows reais, coerção do driver ou collations.       |
| Média      | Regras de sort divergem                                 | Prisma permite alguns campos por `fields`; TypeORM e Drizzle exigem `sorts`.  |
| Média      | Sort duplicado diverge                                  | TypeORM mantém a última direção, Drizzle a primeira e Prisma mantém ambas.    |
| Média      | Agregação profunda do Drizzle não é aninhada            | Caminhos são transformados em chaves como `company_owner`.                    |
| Média      | PK root hard-coded no TypeORM                           | `fields.handler.ts` injeta `${alias}.id`.                                     |
| Média      | Parsing numérico é permissivo                           | `parseInt()` aceita prefixos como `10abc` e trunca decimais.                  |
| Média      | Boolean inválido degrada silenciosamente                | TypeORM/Drizzle usam default; Prisma rejeita alguns casos.                    |
| Média      | Exemplos e CI não exercitam a promessa pública          | A CI principal ignora `apps/examples/` e bancos reais.                        |

O relatório externo `coercao-de-filtro-bug-por-adapter.md` foi usado como
evidência, não como instrução. Sua causa-raiz está correta, mas o fallback
silencioso proposto não atende ao contrato v3: metadado ausente deve falhar antes
da consulta, não reativar uma coerção potencialmente incorreta.

## 3. Objetivos

1. Entregar a mesma gramática REST e a mesma semântica observável nas nove
   combinações suportadas.
2. Validar e coagir cada valor a partir do tipo real do campo.
3. Tornar impossível uma degradação silenciosa por ORM, provider ou dialeto.
4. Garantir whitelist exata e projeção segura de root e relações.
5. Remover casts do uso público normal.
6. Isolar peers opcionais por subpath.
7. Provar a compatibilidade em bancos reais na CI.
8. Disponibilizar migração explícita da v2, inclusive para comportamentos que
   antes funcionavam por coerção do banco.

## 4. Não objetivos

- Reimplementar um ORM ou gerar SQL único para todos os bancos.
- Suportar versões de banco ou ORM fora da matriz publicada.
- Igualar planos de execução ou SQL textual entre adapters.
- Expor todos os recursos específicos de cada ORM pela gramática comum.
- Prometer igualdade sob collations, timezone ou schemas arbitrários.
- Manter quirks da v2 quando conflitarem com correção, segurança ou paridade.
- Implementar ordenação ambígua por uma relação `many` sem uma agregação
  declarada.

## 5. Definição operacional de “funcionar perfeitamente”

Uma combinação é suportada quando, para o perfil publicado:

1. Importação, geração de tipos e build funcionam em um projeto consumidor
   isolado.
2. Toda query do corpus resulta no mesmo status e código de erro.
3. Sucessos têm os mesmos IDs, na mesma ordem, com a mesma paginação.
4. O JSON tem os mesmos campos, aninhamento, nulabilidade e valores canônicos.
5. Entradas inválidas falham antes de executar SQL.
6. Nenhum recurso é ignorado ou aproximado silenciosamente.
7. Data e count observam o mesmo plano pós-customização.
8. Os limites de desempenho definidos na seção 18 são respeitados.

## 6. Matriz suportada

### 6.1 Runtime principal de release

| Dimensão   | Alvo principal | Compatibilidade adicional                       |
| ---------- | -------------- | ----------------------------------------------- |
| Node.js    | 24.x           | 22.x; 26.x após entrar em LTS e passar na suíte |
| NestJS     | 11.x           | próxima major somente após suíte própria        |
| TypeORM    | 1.1.x          | 0.3.31 em suíte de compatibilidade              |
| Prisma     | 7.x            | 6.19.x em suíte de compatibilidade              |
| Drizzle    | 1.x estável    | RC equivalente apenas em releases v3 prévias    |
| PostgreSQL | 18             | 16 como mínimo testado                          |
| MySQL      | 8.4 LTS        | 8.0 como mínimo testado                         |
| SQL Server | 2022           | 2019 como mínimo testado                        |

A matriz semântica obrigatória usa os alvos principais. Versões mínimas rodam em
uma matriz de compatibilidade agendada e antes de cada release.

### 6.2 Política de suporte

- Faixas de peer dependency somente serão ampliadas após testes reais.
- CLI e Client do Prisma devem usar a mesma major e uma combinação oficialmente
  compatível.
- Drizzle 0.45 permanece na linha v2 da biblioteca.
- Falha em uma célula bloqueia release; skips são proibidos em `3.0.0` estável.
- Combinações experimentais são publicadas apenas em pré-release e identificadas
  no manifesto de capacidades.

### 6.3 Perfil certificado de banco

Paridade não é prometida sobre configuração arbitrária. Cada célula da matriz
usa um perfil versionado e reproduzível, instalado por migrations/fixtures da
biblioteca:

- encoding Unicode completo e collation binária/code-point certificada pelo
  corpus para campos textuais portáveis;
- valores textuais persistidos em NFC;
- sessão e armazenamento de datetime em UTC, preservando `date` como data civil;
- modo SQL estrito, precisão decimal declarada e ausência de conversão implícita
  nos campos exercitados;
- índices equivalentes para PKs, FKs, folded fields e chaves de ordenação;
- checks de inicialização que consultam metadados/catálogos e geram
  `PORTABILITY_PROFILE_MISMATCH` antes de aceitar tráfego.

O projeto publicará um profile por PostgreSQL, MySQL e SQL Server com DDL,
imagem, configuração de sessão e seed. Uma aplicação pode usar outro profile,
mas só recebe o selo de paridade se executar e passar o mesmo conformance kit.

## 7. Arquitetura

```text
Entrada HTTP / QueryInput
        │
        ▼
Parser canônico
        │ UntypedQueryAst
        ▼
Autorização + resolução de schema
        │ ResolvedQueryAst
        ▼
Coerção + validação semântica
        │ TypedQueryPlan
        ▼
transformPlan comum
        │ TypedQueryPlan final
        ├──────────────┬──────────────┐
        ▼              ▼              ▼
Compiler TypeORM  Compiler Prisma  Compiler Drizzle
        │              │              │
        ▼              ▼              ▼
  Contexto nativo / customize tipado
        │
        ▼
Execução data + count
        │
        ▼
Normalização recursiva
        │
        ▼
QueryResult JSON-canônico
```

### 7.1 Módulos do core

| Unidade              | Responsabilidade                                               |
| -------------------- | -------------------------------------------------------------- |
| `query-parser`       | Converter `QueryInput` em AST sem tipos de ORM.                |
| `schema`             | Representar campos, PKs, relações, tipos e capacidades.        |
| `authorization`      | Aplicar whitelists exatas e regras por operador.               |
| `coercion`           | Converter valores HTTP em escalares lógicos sem perda.         |
| `semantic-validator` | Validar operador, tipo, aridade e capacidade.                  |
| `query-plan`         | Representar filtro, search, sort, projeção e paginação finais. |
| `errors`             | Criar erros estáveis, seguros e serializáveis.                 |
| `result-normalizer`  | Produzir shape e escalares JSON uniformes.                     |

O core não importa TypeORM, Prisma, Drizzle nem drivers de banco.

## 8. API pública v3

### 8.1 Source discriminada

```ts
await queryService.execute(typeormSource(repository), query, rules);

await queryService.execute(
  prismaSource({ client: prisma, model: 'user', manifest }),
  query,
  rules
);

await queryService.execute(
  drizzleSource({ db, table: users, relations }),
  query,
  rules
);
```

Cada factory retorna uma `QuerySource<TRow, TNativeContext>` com discriminante,
adapter, contexto e schema resolver. `execute()` infere source, resultado e tipo
do callback sem cast.

### 8.2 Configuração global

`DynamicQueryBuilderModule.forRoot()` configura apenas políticas comuns:

```ts
DynamicQueryBuilderModule.forRoot({
  pagination: { defaultPerPage: 20, maxPerPage: 100 },
  textProfile: 'portable-strict',
  consistency: 'eventual',
  logging: { enabled: true, level: 'info', redactValues: true },
});
```

Não existe adapter default implícito. A source determina o adapter.

### 8.3 Regras de endpoint

```ts
const rules = defineQueryRules(userSchema, {
  filters: [
    { path: 'id', operators: ['eq', 'in'] },
    { path: 'name', operators: ['eq', 'like', 'ilike'] },
    { path: 'company.name', operators: ['eq', 'ilike'] },
  ],
  sorts: ['id', 'name', 'company.name'],
  fields: {
    root: {
      allowed: ['id', 'name', 'email'],
      default: ['id', 'name'],
    },
    relations: {
      company: {
        allowed: ['id', 'name'],
        default: ['id', 'name'],
      },
    },
  },
  includes: ['company'],
  search: ['name', 'email', 'company.name'],
});
```

Regras são validadas na construção:

- Todos os paths devem existir no schema.
- `default` deve ser subconjunto de `allowed`.
- Campos de search devem ser textuais e possuir estratégia insensível.
- Relações declaradas em projeção devem estar autorizadas em `includes`.
- Operadores configurados devem ser compatíveis com o tipo do campo.
- Paths são exatos. `company` não autoriza `company.name`.
- Wildcard exige a forma explícita `company.*` e expande somente durante a
  validação das regras, nunca a partir de input do cliente.

## 9. Schema lógico

```ts
type ScalarKind =
  | 'string'
  | 'uuid'
  | 'enum'
  | 'integer'
  | 'bigint'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'json'
  | 'binary';

interface FieldDescriptor {
  path: string;
  kind: ScalarKind;
  nullable: boolean;
  primaryKey: boolean;
  foldedField?: string;
  portableOrderField?: string;
}

interface RelationDescriptor {
  path: string;
  target: string;
  cardinality: 'one' | 'many';
  nullable: boolean;
}

interface QuerySchema {
  model: string;
  fields: ReadonlyMap<string, FieldDescriptor>;
  relations: ReadonlyMap<string, RelationDescriptor>;
  primaryKey: readonly string[];
}
```

Campos computados, views e aliases entram por extensão explícita do schema. Um
tipo desconhecido não é tratado como string; ele bloqueia o uso do campo até ser
mapeado. `foldedField` e `portableOrderField` são colunas internas: não podem
ser expostas pela API e precisam ter integridade verificada no conformance kit.
O segundo é obrigatório quando o tipo físico não possui a mesma ordem total nas
três famílias de banco, como UUID nativo ou enumeração dependente do provider.

### 9.1 Origem dos metadados

- TypeORM: `Repository.metadata`, incluindo columns, embedded paths, PKs e
  relations.
- Drizzle: objetos de coluna e mapa explícito de relações/joins.
- Prisma: manifesto TypeScript gerado a partir de `schema.prisma` pelo generator
  da biblioteca.
- Prisma manual: permitido para ambientes sem generator, usando a mesma
  interface e validação. Não é fallback automático.

## 10. Gramática e coerção

A gramática externa preserva `filter`, `sort`, `fields`, `includes`, `search`,
`page`, `perPage` e `paginate`. O parser aceita strings já expandidas pelo `qs`
e arrays legítimos.

### 10.1 Escalares

| Tipo             | Entrada aceita                  | Valor lógico                  | JSON de saída  |
| ---------------- | ------------------------------- | ----------------------------- | -------------- |
| string/UUID/enum | texto                           | string sem coerção numérica   | string         |
| integer          | regex de inteiro e faixa segura | number inteiro                | number         |
| bigint           | regex de inteiro                | bigint                        | string decimal |
| decimal          | decimal finito canônico         | string de precisão arbitrária | string decimal |
| boolean          | `true`, `false`, `1`, `0`       | boolean                       | boolean        |
| date             | `YYYY-MM-DD` válida             | data civil                    | `YYYY-MM-DD`   |
| datetime         | ISO 8601 com offset ou `Z`      | instante UTC                  | ISO 8601 UTC   |
| binary           | não filtrável por default       | buffer/bytes                  | base64         |
| JSON             | somente operadores registrados  | JSON validado                 | JSON           |

Regras adicionais:

- String de filtro não perde espaços automaticamente.
- Search remove apenas espaços externos do termo completo.
- Integer não usa `parseInt()` permissivo.
- Decimal nunca passa por `number`.
- Datetime sem timezone é inválido no perfil estrito.
- Strings gravadas fora dos helpers da biblioteca precisam estar em NFC; o check
  de integridade detecta divergências antes da certificação do ambiente.
- `null` só é consultado por `isNull`.
- Valor inválido gera erro antes do compiler.

### 10.2 Listas

- Arrays expandidos pelo parser são a forma preferencial.
- CSV legado continua aceito com aspas e escape por barra invertida.
- `in=[]` compila para condição sempre falsa.
- `notIn=[]` compila para condição sempre verdadeira.
- `between` exige exatamente dois valores.
- Cada item é coagido pelo mesmo codec do campo.

## 11. Semântica dos operadores

| Operador                 | Semântica v3                                       |
| ------------------------ | -------------------------------------------------- |
| `eq`                     | igualdade tipada                                   |
| `ne`                     | desigualdade tipada                                |
| `gt`, `gte`, `lt`, `lte` | comparação de tipo ordenável                       |
| `between`                | intervalo inclusivo                                |
| `like`, `notLike`        | contém case-sensitive, input literal               |
| `ilike`, `notIlike`      | contém case-insensitive, input literal             |
| `in`, `notIn`            | pertinência após coerção item a item               |
| `isNull`                 | nulidade de scalar ou ausência/presença de relação |

`%`, `_` e `\` são caracteres literais na API. A biblioteca escolhe e escapa o
caractere de escape por dialeto. Um futuro operador de pattern deverá ter outro
nome e contrato explícito.

Operadores de ordem aplicam-se diretamente a integer, bigint, decimal, date,
datetime e string sob o profile certificado. UUID e enum exigem
`portableOrderField`; sem ele, `gt`, `gte`, `lt`, `lte`, `between` e sort falham
com `CAPABILITY_UNAVAILABLE`. `like` aplica-se somente a campos textuais. JSON e
binary não recebem operadores por inferência.

Filtros independentes são combinados com `AND`. Search combina seus campos com
`OR` e entra como mais um termo do `AND` principal.

### 11.1 Relações

- Dotted path por relação `one`: a folha é comparada na relação associada.
- Dotted path por relação `many`: semântica existencial “algum item corresponde”.
- `isNull=true` em `one`: relação ausente.
- `isNull=false` em `one`: relação presente.
- `isNull=true` em `many`: coleção vazia.
- `isNull=false` em `many`: pelo menos um item.
- Outros operadores aplicados diretamente à relação são inválidos.
- Sort direto por folha através de `many` é inválido em todos os adapters.

## 12. Perfil textual portável

Collations arbitrárias não produzem resultados equivalentes. O perfil
`portable-strict` fixa as seguintes regras:

1. Campos textuais originais usados por `eq`, `ne` ou `like` devem usar
   comparação case-sensitive e accent-sensitive.
2. Todo campo autorizado para `ilike`, `notIlike` ou `search` declara um
   `foldedField` oculto no schema.
3. O folded field armazena `value.normalize('NFC').toLowerCase()` produzido pelo
   helper público da biblioteca.
4. O termo recebido passa pelo mesmo helper antes da compilação.
5. O folded field não pode ser autorizado em filters, fields, sorts ou includes.
6. Adapters consultam o folded field com comparação literal; não dependem de
   `ILIKE`, `mode` ou collation case-insensitive.
7. A aplicação consumidora é responsável por preencher o folded field nas
   escritas. Exemplos e generator entregam integração pronta para cada ORM.
8. O campo original e o folded field usam a collation certificada do profile;
   assim `eq`, `ne`, `like` e a comparação do valor dobrado não herdam o default
   do servidor ou da base.
9. O conformance kit inclui caracteres fora de ASCII, formas Unicode compostas
   e decompostas e pares com caixa/acento para impedir falsos positivos.

Esse perfil permite o mesmo comportamento inclusive no Prisma com MySQL e SQL
Server, onde não há `mode: 'insensitive'`. Um perfil `database-native` pode ser
oferecido como opt-in, mas não recebe selo de paridade cross-database.

## 13. Projeção, includes e shape

- Sem `fields` na URL, são usados os `default` configurados para root e para
  cada relação incluída.
- Com `fields`, apenas campos solicitados e autorizados são expostos no nível
  correspondente.
- `fields=company.name` exige `includes=company`; seleção não inclui relação
  implicitamente.
- `includes=company` sem fields dotted usa os defaults de `company`.
- Uma relação sem ao menos um campo default autorizado torna as regras inválidas.
- PKs podem ser selecionadas internamente para hidratação, deduplicação e
  paginação, mas são removidas do JSON se não fizerem parte da projeção visível.
- Relação `one` retorna objeto ou `null`.
- Relação `many` retorna array, inclusive quando vazio.
- Relações profundas permanecem aninhadas: `company.owner`, nunca
  `company_owner`.
- Ordem de arrays relacionados não é inferida do sort root. Uma futura opção de
  relation sort terá contrato próprio.

## 14. Paginação e ordenação

- `page` e `perPage` aceitam somente inteiros decimais completos.
- `page >= 1`, `perPage >= 1` e `perPage <= maxPerPage`.
- Valores cujo cálculo de offset não seja seguro são rejeitados.
- Sort duplicado com a mesma direção é deduplicado.
- Sort duplicado com direções conflitantes gera `SORT_CONFLICT`.
- A PK completa é anexada como desempate quando tiver ordem portável. Partes sem
  ordem portável usam seu `portableOrderField` correspondente.
- Sem sort informado, essa mesma chave de desempate ascendente é usada.
- Toda source deve expor uma chave total, única, não nula e portavelmente
  ordenável. A inicialização falha se isso não puder ser provado pelo schema.
- Paginação com relação `many` opera sobre roots distintos.
- `total` conta roots, não linhas de join.
- A ordem retornada pela segunda fase deve preservar a ordem de IDs da primeira.
- `lastPage` permanece no mínimo `1` para compatibilidade com o contrato atual.
- `paginate=false` retorna apenas `{ data }`.

O default `consistency: 'eventual'` permite data e count em duas queries. A opção
`consistency: 'transactional'` executa ambas em uma transação/snapshot compatível
com o adapter e falha cedo se o provider não oferecer a garantia solicitada.

## 15. Contrato dos adapters

```ts
interface RestQueryAdapter<TSource, TCompiled, TRow> {
  readonly id: 'typeorm' | 'prisma' | 'drizzle';

  describe(source: TSource): Promise<QuerySchema>;
  capabilities(source: TSource): AdapterCapabilities;
  compile(plan: TypedQueryPlan, source: TSource): TCompiled;
  customize(compiled: TCompiled, callback: (value: TCompiled) => void): void;
  execute(compiled: TCompiled): Promise<AdapterResult<TRow>>;
  normalize(
    result: AdapterResult<TRow>,
    schema: QuerySchema
  ): QueryResult<TRow>;
}
```

### 15.1 TypeORM

- Usa um estado que preserva `Repository`, metadata e `SelectQueryBuilder`.
- Cria joins idempotentes para filter, search, sort e fields mesmo sem include.
- Separa joins de predicado dos joins de apresentação.
- Descobre PKs simples/compostas.
- Projeta cada alias explicitamente.
- Usa paginação em duas fases quando joins `many` puderem inflar roots.
- `customize` recebe o `SelectQueryBuilder` tipado.

### 15.2 Prisma

- O generator produz tipos, manifestos e factories de source por model.
- O model/delegate não é uma string livre sem validação.
- Relações `many` usam filtros `some` e relações vazias usam `none`.
- `select` é a árvore canônica; includes são convertidos para seleção de relação.
- Provider e capacidades vêm do manifesto/source.
- O perfil estrito usa folded fields; `mode: 'insensitive'` não é emitido nesse
  perfil.
- `customize` recebe um accumulator Prisma tipado e validável.

### 15.3 Drizzle

- Baseia-se em Drizzle 1.x.
- Usa colunas reais para tipos e bindings.
- Relações/joins são declarados explicitamente e validados na source.
- SQL helpers são escolhidos por dialeto; `ilike()` não é emitido em MySQL ou
  SQL Server.
- Count, distinct, paginação e escaping têm estratégia por dialeto.
- A agregação é recursiva e orientada pelo schema.
- `customize` recebe um accumulator tipado antes da materialização final.

## 16. Hooks

Existem dois níveis deliberadamente separados:

1. `transformPlan(plan)` é comum aos adapters. Serve para tenant, soft delete,
   políticas internas e filtros não expostos na URL.
2. `customize(nativeContext)` é específico do adapter e serve para capacidades
   nativas fora do contrato REST.

O plano final é congelado após `transformPlan`. O contexto de data e count deriva
desse mesmo plano. Customize deve declarar se afeta `data`, `count` ou ambos; o
default seguro é ambos. Customização inconsistente exige opção explícita e gera
warning estruturado.

## 17. Erros e observabilidade

### 17.1 Envelope público

```json
{
  "statusCode": 400,
  "code": "FILTER_VALUE_INVALID",
  "message": "Valor inválido para o campo age",
  "details": {
    "path": "age",
    "operator": "gte",
    "expected": "integer"
  }
}
```

Famílias de código:

- `QUERY_SYNTAX_*`
- `FIELD_NOT_ALLOWED`
- `FIELD_NOT_FOUND`
- `RELATION_NOT_FOUND`
- `OPERATOR_NOT_ALLOWED`
- `OPERATOR_TYPE_MISMATCH`
- `FILTER_VALUE_INVALID`
- `PAGINATION_INVALID`
- `SORT_CONFLICT`
- `CAPABILITY_UNAVAILABLE`
- `PORTABILITY_PROFILE_MISMATCH`
- `SOURCE_CONFIGURATION_INVALID`
- `ADAPTER_CONTRACT_VIOLATION`

Erros de input são `400`. Configuração inválida falha na inicialização. Erros do
driver/ORM permanecem internos e não vazam SQL, conexão, stack ou valores.

Logging é estruturado e redige valores por default. Pode registrar adapter,
dialeto, model, campos, operadores, duração, paginação, quantidade de rows e
correlation ID. SQL e parâmetros só aparecem com opt-in de desenvolvimento.

## 18. Testes e performance

### 18.1 Camadas

1. Unitários do parser, schema, autorização, coerção, AST e normalização.
2. Property-based/fuzz para paths, listas, números, datas e inputs hostis.
3. Contract tests que passam a mesma AST a todos os adapters.
4. Integração real nas nove células ORM × banco.
5. E2E HTTP com NestJS/Express 5 e parser extended.
6. Projetos consumidores isolados para peers, CJS, ESM e declarations.
7. Builds e smoke tests de todos os exemplos.

### 18.2 Corpus obrigatório

O seed inclui texto numérico, zeros à esquerda, CPF/CEP, alfanumérico, limites de
integer/bigint, decimal de alta precisão, booleanos, date, datetime com offsets,
null, `%`, `_`, `\`, vírgula, espaços, caixa, acentos, Unicode fora de ASCII,
formas NFC/NFD, relações `one`, `many` e profundas, roots sem relações, PK
numérica, UUID e composta, empates de sort e múltiplas páginas.

### 18.3 Asserts

Cada caso compara:

- status e código de erro;
- IDs e ordem;
- data length, total e lastPage;
- campos presentes/ausentes;
- shape de relações;
- valores JSON canônicos;
- número de queries quando relevante;
- execução sem scan/conversão de coluna nos casos indexáveis críticos.

### 18.4 Orçamento

- Parser/validação: p95 inferior a `1 ms` para até 50 filtros em hardware de CI.
- Overhead total da biblioteca sem I/O: p95 inferior a `2 ms` no corpus padrão.
- Nenhuma query N+1 introduzida por includes.
- Paginação `many` usa no máximo duas queries de dados mais uma de count.
- Regressão superior a 20% no benchmark de referência bloqueia release até ser
  explicada e aprovada.

## 19. CI

| Job                  | Gate                                          |
| -------------------- | --------------------------------------------- |
| `contract-fast`      | unitários, type tests e fuzz reduzido         |
| `adapter-contract`   | todos os compilers sem banco                  |
| `database-matrix`    | nove combinações reais, sem skips             |
| `peer-compatibility` | versões mínimas e máximas                     |
| `examples`           | build, start, health check e corpus smoke     |
| `package-consumers`  | instalação isolada por subpath/peer e CJS/ESM |
| `quality`            | format, lint, typecheck, build e cobertura    |
| `security`           | CodeQL, dependências e injeção                |
| `performance`        | nightly e antes de release                    |

SQL Server roda em runner Linux x64. Os testes locais em ARM podem omitir essa
célula, mas merge e release não podem.

## 20. Empacotamento

```text
nestjs-rest-query             core, decorators e contratos
nestjs-rest-query/typeorm     runtime TypeORM
nestjs-rest-query/prisma      runtime Prisma
nestjs-rest-query/drizzle     runtime Drizzle
```

- O root não reexporta classes runtime dos adapters.
- Types compartilhados podem ser reexportados com `export type`.
- Cada subpath declara e testa somente seu peer.
- O pacote publica ESM e CJS com declarations equivalentes.
- `publint`, `arethetypeswrong` e consumer fixtures são gates.

## 21. Fases de entrega

### Fase 0 — Contrato e baseline

- Congelar gramática, schema lógico e corpus.
- Converter falhas auditadas em testes inicialmente vermelhos.
- Fixar perfis de banco, collation, timezone e serialização.
- Criar harness reutilizável para todas as células.

### Fase 1 — Core semântico

- Parser, AST, autorização, schema, codecs, erros e normalização.
- Regras exatas e operador por campo.
- Paginação e sort determinísticos.
- Fuzz e type tests.

### Fase 2 — API e distribuição v3

- Sources discriminadas e inferência completa.
- `transformPlan` e `customize`.
- Subpaths isolados, ESM/CJS e consumer fixtures.
- Primeira versão do migration guide.

### Fase 3 — TypeORM de referência

- Metadata resolver, joins automáticos, projeção e PKs compostas.
- Paginação root-distinta.
- Integração PostgreSQL, MySQL e SQL Server.

### Fase 4 — Prisma

- Generator e manifesto.
- Compilação de filtros, relations, select, sort e paginação.
- Compatibilidade Prisma 6.19/7.
- Integração PostgreSQL, MySQL e SQL Server.

### Fase 5 — Drizzle

- Migração para Drizzle 1.x.
- Estratégias por dialeto e agregação recursiva.
- Integração PostgreSQL, MySQL e SQL Server.

### Fase 6 — Paridade completa

- Executar todo o corpus nas nove células.
- Eliminar divergências de resultado e todos os skips.
- Validar consistência eventual/transacional e performance.

### Fase 7 — Hardening e release

- Corrigir e automatizar exemplos.
- Documentar em português e inglês.
- Finalizar migração v2 → v3 e codemods seguros.
- Publicar alpha, beta e RC.
- Publicar `3.0.0` somente após todos os gates.

## 22. Estratégia de migração

- A linha v2 recebe apenas correções críticas e documentação de limitações.
- A v3 não preserva coerção por aparência textual.
- `coercion: 'legacy'` não existe no contrato estável v3.
- Um pacote/helper de diagnóstico analisa regras v2 e aponta paths implícitos,
  PK `id` presumida, uso de wildcard, sort ambíguo e configuração de fields.
- Codemods podem transformar imports e wrappers de source; decisões de schema,
  folded fields e autorização permanecem revisão humana.
- Mudanças de resposta, `in=[]`, projeção, erros e ordenação são destacadas no
  migration guide com exemplos antes/depois.

## 23. Gates da `3.0.0`

- Nove combinações reais verdes sem skips.
- Drizzle/MSSQL em versão estável suportada.
- Nenhum cast no uso público documentado.
- Nenhum peer opcional carregado pelo core.
- Todos os exemplos compilam e passam smoke E2E.
- Códigos de erro e JSON canônico idênticos.
- Cobertura de branches críticos acima de 95%.
- Nenhum achado de segurança alto ou crítico aberto.
- Benchmarks dentro do orçamento.
- Migration guide validado em um consumidor v2 real e em projeto vazio.
- Matriz pública de versões e limitações coincide com a CI.
- Profiles de banco passam nos checks de collation, Unicode, timezone, precisão
  e ordenação portável.

## 24. Riscos e mitigação

| Risco                                              | Mitigação                                                              |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| Drizzle 1.x/MSSQL atrasar ou mudar API             | manter v3 em pré-release e isolar o compiler Drizzle                   |
| Custo da matriz de nove células                    | jobs paralelos, imagens cacheadas e corpus fast/full                   |
| Folded fields aumentarem setup                     | generator, helpers de escrita, migrations e validação na inicialização |
| Metadata divergente entre ORMs                     | schema lógico comum e fixtures geradas do mesmo modelo canônico        |
| Paginação com joins degradar                       | duas fases, índices exigidos e testes de plano/performance             |
| Compatibilidade TypeORM 0.3/1.x ampliar manutenção | suíte separada; remoção em major futura se necessário                  |
| Customização quebrar count                         | declaração de escopo, plano compartilhado e contract tests             |
| Normalização alterar tipos esperados               | tipos de saída explícitos e migration guide                            |

## 25. Decisões finais

1. A implementação será uma v3 com breaking changes.
2. O núcleo semântico canônico é a fonte de verdade.
3. Metadado ausente falha fechado; não há fallback legado.
4. Paridade é medida no resultado real, não na forma do SQL.
5. O perfil textual estrito usa folded fields para eliminar dependência de
   collation e capacidades desiguais do Prisma.
6. Sort por `many` permanece inválido até existir agregação explícita.
7. O root package não carrega ORMs.
8. A versão estável depende de Drizzle/MSSQL estável e matriz sem skips.

## 26. Referências técnicas verificadas

- [Bancos suportados pelo Prisma](https://docs.prisma.io/docs/orm/core-concepts/supported-databases)
- [Case sensitivity e diferenças de provider no Prisma](https://docs.prisma.io/docs/orm/v6/prisma-client/queries/case-sensitivity)
- [Upgrade para Prisma ORM 7](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7)
- [Mudanças do Drizzle v0 para v1](https://orm.drizzle.team/docs/v0-v1-changes)
- [Upgrade do Drizzle v1](https://orm.drizzle.team/docs/upgrade-v1)
- [Upgrade do TypeORM 0.3 para 1.0](https://dev.typeorm.io/docs/releases/1.0/upgrading-from-0.3/)
