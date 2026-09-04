# Migração v2 → v3

A v3 substitui a tradução independente de query em cada adapter por um núcleo
semântico único. A entrada HTTP vira uma AST tipada, validada contra um schema
lógico e autorizada por regras exatas; os adapters apenas compilam esse plano
para a API do ORM.

Isso torna a v3 **breaking em vários pontos observáveis**. Este guia lista cada
mudança com o antes e o depois.

> **Estado desta versão.** O núcleo semântico, a API pública e o adapter
> TypeORM estão implementados. Os adapters Prisma e Drizzle publicam subpath
> mas ainda lançam `ADAPTER_CONTRACT_VIOLATION`: eles chegam nas fases 4 e 5 do
> plano da v3. A `3.0.0` estável depende da matriz completa verde.

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
`SOURCE_CONFIGURATION_INVALID`. A restrição de operadores agora é **por campo**,
declarada nas regras do endpoint.

O default de `defaultPerPage` mudou de `10` para `20`.

## 2. Schema lógico e regras de endpoint

`RulesConfig` sai. As regras passam por `defineQueryRules`, que valida tudo na
construção — paths inexistentes, defaults fora de allowed, operadores
incompatíveis com o tipo e sort ambíguo falham ao subir a aplicação, não na
primeira requisição.

```ts
// v2
const rules: RulesConfig<User> = {
  filters: ['id', 'name', 'company'],
  sorts: ['id', 'name'],
  fields: ['id', 'name', 'email', 'company'],
  includes: ['company'],
  search: ['name', 'email'],
};

// v3
import { buildSchemaRegistry } from 'nestjs-rest-query/typeorm';

const registry = buildSchemaRegistry(userRepository);

const rules = defineQueryRules(registry, 'user', {
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
  search: ['name', 'email'],
});
```

Pontos de atenção:

- **Paths são exatos.** Na v2, autorizar `company` também aceitava
  `company.<qualquer-campo>`. Na v3 é preciso declarar `company.name`
  explicitamente. Revise cada whitelist: a v2 pode estar expondo mais do que
  você pretendia.
- **`fields` deixou de restringir sort.** Na v2, definir `fields` restringia
  implicitamente os campos de `sort`. Na v3 as duas listas são independentes.
- **Toda relação em `includes` precisa de projeção declarada** em
  `fields.relations`, com pelo menos um campo default.
- **Wildcard** existe só na construção, na forma explícita `'company.*'`, e
  nunca é aceito vindo do cliente.

## 3. Chamada do serviço

A source discriminada substitui o repositório solto, e `execute` infere o tipo
da linha sem cast.

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
  // Hook específico do adapter, para capacidades fora do contrato REST.
  customize: (compiled) => {
    compiled.data.andWhere('root.tenant_id = :tenant', { tenant });
  },
  customizeScope: 'both',
});
```

`customize` declara se afeta `data`, `count` ou ambos; o default seguro é
`both`. Um escopo parcial gera warning estruturado, porque o count pode passar
a descrever uma pergunta diferente da dos dados.

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
- `ilike` e `notIlike` exigem um `foldedField` declarado no schema. Sob o perfil
  `portable-strict`, eles consultam essa coluna com comparação literal — sem
  `ILIKE`, sem `mode: 'insensitive'` e sem depender da collation do servidor. É
  o que permite o mesmo resultado no Prisma com MySQL e SQL Server.
- **Sua aplicação é responsável por preencher o folded field na escrita**, com
  o helper `foldText(value)` exportado pelo pacote.
- `in=[]` passa a compilar para condição sempre falsa (zero linhas). A v2
  ignorava o filtro e retornava tudo.
- `notIn=[]` compila para condição sempre verdadeira.
- `between` exige exatamente dois valores.
- Ordem (`gt`, `gte`, `lt`, `lte`, `between`) sobre `uuid` ou `enum` exige um
  `portableOrderField`, porque esses tipos não ordenam igual nas três famílias
  de banco.

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

## 7. Ordenação e paginação

- Sort duplicado com a mesma direção é deduplicado; com direções conflitantes
  gera `400 SORT_CONFLICT`. A v2 mantinha a última direção no TypeORM, a
  primeira no Drizzle e ambas no Prisma.
- A PK completa é anexada como desempate, inclusive quando não há sort na URL.
- Sort direto por uma folha através de relação `many` é inválido.
- `page` e `perPage` aceitam somente inteiros decimais completos e positivos.
  `?page=` (vazio) passa a ser erro, não default.
- `total` conta roots, não linhas de join.
- `lastPage` continua no mínimo `1`.

## 8. Erros

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
import { TypeOrmAdapter, DrizzleAdapter } from 'nestjs-rest-query';

// v3
import { typeormSource } from 'nestjs-rest-query/typeorm';
```

O pacote publica ESM e CJS com declarations equivalentes, e cada subpath declara
apenas o seu peer.

## 10. Perfil certificado de banco

A paridade só é prometida sobre um perfil versionado: encoding Unicode,
collation binária/code-point nas colunas textuais portáveis, valores em NFC,
sessão e armazenamento em UTC, modo estrito e precisão decimal declarada. A DDL
de cada família vive em `test/profiles/`.

Uma aplicação pode usar outro perfil, mas só recebe o selo de paridade se
executar e passar o mesmo conformance kit. `checkPortabilityProfile` transforma
os fatos do catálogo em violações antes de a aplicação aceitar tráfego.

---

## Diferenças em relação ao design aprovado

O design (`docs/superpowers/specs/2026-09-03-v3-paridade-orm-bancos-design.md`)
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
