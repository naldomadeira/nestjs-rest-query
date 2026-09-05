# Migration Guide

| You are on                                        | Target                      | Section                                                                              |
| ------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------ |
| `@multitechbr/nestjs-dynamic-query-builder` `4.x` | `nestjs-rest-query` `1.0.0` | [Package rename](#from-multitechbrnestjs-dynamic-query-builder-to-nestjs-rest-query) |
| `1.x`                                             | `2.x`                       | [1.x → 2.x](#1x--2x)                                                                 |
| `2.x`                                             | `3.x`                       | [2.x → 3.x](#2x--3x)                                                                 |

The exhaustive v3 reference — full coercion table, error envelope, projection
rules, certified database profile — is
[`docs/v3/migration-from-v2.md`](./docs/v3/migration-from-v2.md) (Portuguese).
This file is the ordered path a real consumer walks; that one is the per-topic
reference. Where they overlap, this file links instead of restating.

Reference implementations: the four apps under
[`apps/examples/`](./apps/examples/) were migrated from v2 to v3 and are the
source of truth for every before/after pair below — `01-starter-app` and
`02-app-with-postgres` (TypeORM), `03-app-with-drizzle`, `04-app-with-prisma`.

---

## 2.x → 3.x

> **The public API changed.** v3 replaces per-adapter query translation with a
> single semantic core: the HTTP input becomes a typed AST, validated against a
> declared logical schema and authorised by exact rules; adapters only compile
> that plan. There is no compatibility mode. A 2.x application does not
> compile against v3, and several observable behaviours changed on purpose.

> **Prerelease.** v3 is not a stable `3.0.0` yet. Current per-cell state and the
> remaining release gates are in [`docs/v3/status.md`](./docs/v3/status.md);
> the supported version matrix is in
> [`docs/v3/versions.md`](./docs/v3/versions.md).

### The real name map

The `1.0.0` section of this guide used to announce a `RestQuery*` rename for a
future major. **That rename was cancelled.** The names below are what v3
actually ships; `RestQueryRules`, `RestQueryResult`, `RestQueryDto`,
`RestQueryService` and `RestQueryModule` do not exist in any version.

| v2                                                                         | v3                                                                                                                    |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `DynamicQueryBuilderModule`                                                | unchanged, but `forRoot` rejects `adapter` and `operators`                                                            |
| `QueryBuilderService`                                                      | unchanged, but `execute()` takes a source, not a repository                                                           |
| `DynamicQueryDto`, `QueryInput`                                            | unchanged                                                                                                             |
| `@DynamicQuery`, `@QueryRules()`                                           | unchanged                                                                                                             |
| `@ApiDynamicQuery<T>({ filters: [...] })`                                  | `@ApiDynamicQuery(rules)` — **no type parameter**, takes the compiled rules                                           |
| `ApiPaginatedResponse`                                                     | unchanged, same signature and same envelope                                                                           |
| `dqbSwaggerRequestInterceptor`                                             | unchanged                                                                                                             |
| `DQB_CONFIG_TOKEN`                                                         | unchanged                                                                                                             |
| `RulesConfig`                                                              | **removed.** Rules are built by `defineQueryRules(...)`, which returns `CompiledQueryRules`                           |
| `ErrorMessages`                                                            | **removed**                                                                                                           |
| `TypeOrmAdapter`, `DrizzleAdapter`, `PrismaAdapter` exported from the root | **removed from the root.** Adapter classes live in their subpaths, and you normally use the `*Source` factory instead |
| `PrismaSource` (inline object)                                             | `prismaSource({ client, model, manifest })` + a manifest                                                              |
| `QueryResult<T>`                                                           | still exported, but `execute()` returns `NormalizedQueryResult<T>` — see the trap below                               |

`QueryResult<T>` is a **migration trap**: it is still exported from the root and
is structurally identical to `NormalizedQueryResult<T>`
(`{ data; page?; perPage?; total?; lastPage? }`), so a 2.x return annotation of
`Promise<QueryResult<User>>` keeps compiling and you get no signal that anything
moved. The canonical name is `NormalizedQueryResult`.

`CompiledQueryRules` is **not** a rename of `RulesConfig`. It is a different
concept: rules validated and compiled at construction time, so an impossible
configuration fails when the application boots instead of on the first request.

### Step 1 — peer dependencies

v3 tightens every ORM peer. All four remain optional; the root package loads no
ORM.

| Peer             | v3 range              | What breaks on the way up                                            |
| ---------------- | --------------------- | -------------------------------------------------------------------- |
| `typeorm`        | `^0.3.26 \|\| ^1.0.0` | nothing in the library API; see [ESM](#step-7--esm-nestjstypeorm-12) |
| `drizzle-orm`    | `>=1.0.0-rc.4 <1.0.0` | four things — see [Drizzle](#drizzle-specifics)                      |
| `@prisma/client` | `^6.19.0 \|\| ^7.0.0` | five things if you go to 7.x — see [Prisma](#prisma-specifics)       |
| `@nestjs/common` | `^11.0.0`             | unchanged                                                            |

A 2.x Drizzle consumer was on `0.45.x`, which v3 does **not** accept: the range
is closed on the measured release candidates. That upgrade is mandatory, not
optional.

### Step 2 — `forRoot`

```diff
  DynamicQueryBuilderModule.forRoot({
-   adapter: new DrizzleAdapter(),
-   operators: { allowed: ['eq', 'like'] },
-   pagination: { defaultPerPage: 10, maxPerPage: 100 },
+   pagination: { defaultPerPage: 20, maxPerPage: 100 },
+   textProfile: 'portable-strict', // already the default; shown for clarity
  });
```

`adapter` and `operators` are rejected at startup with
`SOURCE_CONFIGURATION_INVALID` and the message
`forRoot no longer accepts "<key>"; see the v2 to v3 migration guide` — that
guide is this section. There is no implicit default adapter any more: the
adapter is decided by the source you pass to `execute()`.

Operator restriction moved from a global list to a **per-field** declaration in
the endpoint rules. `defaultPerPage` defaults to `20` (it was `10`), so pin it
explicitly if your clients depend on the old page size.

### Step 3 — logical schema and endpoint rules

`RulesConfig` is gone. You now declare a **logical schema** per model (what the
model _is_) and **rules** per endpoint (what that endpoint _authorises_).

```ts
// v2 — apps/examples/02-app-with-postgres, access-requests controller.
// The whitelist lived in the decorator, as flat string lists.
@ApiDynamicQuery<AccessRequest>({
  filters: ['userId', 'overallStatus', 'createdAt', 'user', 'items', 'items.company'],
  sorts: ['userId', 'overallStatus', 'createdAt', 'user.firstName'],
  fields: ['id', 'userId', 'overallStatus', 'createdAt', 'items', 'user'],
  includes: ['user', 'items', 'items.company'],
  search: ['user.firstName', 'items.company.name'],
})
```

```ts
// v3 — apps/examples/01-starter-app/src/product/product.query.ts (comments trimmed)
import { defineQueryRules, defineQuerySchema } from 'nestjs-rest-query';
import type { QuerySchema, SchemaRegistry } from 'nestjs-rest-query';

const categorySchema: QuerySchema = defineQuerySchema({
  model: 'category',
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
    // The folded companion has to be declared, and has to be internal.
    {
      path: 'name_folded',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      internal: true,
    },
  ],
  relations: [],
});

const productSchema: QuerySchema = defineQuerySchema({
  model: 'product',
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
    {
      path: 'name_folded',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      internal: true,
    },
    // The kind decides coercion, not the shape of the incoming text:
    // "10.50" stays an exact decimal and never becomes a float.
    { path: 'price', kind: 'decimal', nullable: false, primaryKey: false },
    { path: 'categoryId', kind: 'integer', nullable: false, primaryKey: false },
    { path: 'createdAt', kind: 'datetime', nullable: false, primaryKey: false },
    { path: 'updatedAt', kind: 'datetime', nullable: false, primaryKey: false },
  ],
  relations: [
    {
      path: 'category',
      target: 'category',
      cardinality: 'one',
      nullable: false,
    },
  ],
});

// Every model reachable from the root must be in the registry.
export const PRODUCT_SCHEMAS: SchemaRegistry = new Map([
  ['product', productSchema],
  ['category', categorySchema],
]);

export const productRules = defineQueryRules(PRODUCT_SCHEMAS, 'product', {
  filters: [
    { path: 'id', operators: ['eq', 'in'] },
    { path: 'name', operators: ['eq', 'like', 'ilike'] },
    { path: 'price', operators: ['eq', 'gt', 'gte', 'lt', 'lte', 'between'] },
    { path: 'categoryId', operators: ['eq', 'in'] },
    { path: 'createdAt', operators: ['gt', 'lt', 'between'] },
    { path: 'category.name', operators: ['eq', 'ilike'] },
  ],
  sorts: ['id', 'name', 'price', 'createdAt'],
  fields: {
    root: {
      allowed: ['id', 'name', 'price', 'categoryId', 'createdAt'],
      default: ['id', 'name', 'price', 'categoryId', 'createdAt'],
    },
    relations: {
      category: { allowed: ['id', 'name'], default: ['id', 'name'] },
    },
  },
  includes: ['category'],
  search: ['name'],
});
```

Note `updatedAt`: it is in the schema and in no whitelist. That is the point of
splitting the two — the model knowing a column does not authorise a client to
ask for it.

Declare the schema by hand. There is a TypeORM derivation helper
(`buildSchemaRegistry(repository)`), but it needs a live `Repository`, and rules
are consumed by `@ApiDynamicQuery(rules)` — a **method decorator**, evaluated
when the controller class loads, before Nest builds the container. All four
examples therefore declare the schema; see
[`docs/v3/migration-from-v2.md` §2](./docs/v3/migration-from-v2.md) for when
`buildSchemaRegistry` is usable instead.

What changed in the whitelist itself:

- **Paths are exact.** In v2, authorising `company` also accepted
  `company.<anything>`. In v3 you declare `company.name`. Re-read every v2
  whitelist: it may have been exposing more than you meant.
- **Operators are per field.** There is no global allow-list.
- **`fields.root` is mandatory**, and every relation in `includes` needs a
  declared projection with a non-empty `default` — and the reverse: a projection
  for a relation that is not in `includes` is refused too. In v2 `fields` was
  optional.
- **`fields` no longer restricts `sort`.** The two lists are independent now.
- Wildcards exist only at construction time, in the explicit form `'company.*'`,
  they must be the **only** entry in that relation's `allowed`, and they are
  never accepted from the client.

Then wire the controller. The compiled rules are the single source for both
authorisation and Swagger:

```diff
- @ApiDynamicQuery<User>({
-   filters: ['username', 'email', 'firstName'],
-   sorts: ['username', 'email', 'createdAt'],
-   fields: ['id', 'username', 'email'],
- })
+ @ApiDynamicQuery(userRules)
  @ApiPaginatedResponse(User, { description: 'User list' })
  async findAll(
    @Query() query: DynamicQueryDto,
-   @QueryRules() rules: RulesConfig,
- ): Promise<QueryResult<User>> {
+   @QueryRules() rules: CompiledQueryRules,
+ ): Promise<NormalizedQueryResult<User>> {
    return this.usersBusiness.findAll(query, rules);
  }
```

Keeping the type parameter on the decorator gives
`TS2558: Expected 0 type arguments, but got 1`.

### Step 4 — `execute()` takes a source, not a repository

This is the error that fires most often on a TypeORM consumer
(`TS2345: Argument of type 'Repository<User>' is not assignable to parameter of
type 'QuerySource<...>'`). The adapter comes from a subpath, because the root
package carries no ORM.

```diff
+ import { typeormSource } from 'nestjs-rest-query/typeorm';

- return this.queryBuilderService.execute(this.userRepository, query, rules);
+ return this.queryBuilderService.execute(
+   typeormSource(this.userRepository),
+   query,
+   rules,
+ );
```

Drizzle and Prisma have `drizzleSource` and `prismaSource`; see the per-ORM
sections. The `customize` hook moved into an options object and now declares its
scope:

```ts
await this.queryService.execute(typeormSource(repository), query, rules, {
  // Adapter-agnostic hook: tenant, soft delete, internal policy.
  transformPlan: (plan) => plan,
  // Adapter-specific hook: the typed SelectQueryBuilder, under TypeORM.
  customize: (qb) => {
    qb.andWhere('root.tenant_id = :tenant', { tenant });
  },
  // 'data' | 'count' | 'both'. 'both' is the safe default: a partial scope
  // lets the count answer a different question than the data, and logs a
  // structured warning.
  customizeScope: 'both',
});
```

Only `typeormSource<T>(repository)` is generic in the row type.
`drizzleSource` and `prismaSource` fix it at `object`, so a 2.x
`Promise<QueryResult<UserDto>>` cannot be reproduced there without an
assertion; the examples annotate `Promise<NormalizedQueryResult<object>>`.

### Step 5 — database migrations v3 requires

This is real DDL work, not configuration. Two new column families, both filled
by your application.

**Folded columns.** Under the `portable-strict` text profile, `search`, `ilike`
and `notIlike` never emit `ILIKE` or Prisma's `mode: 'insensitive'`: they
compare a pre-normalised column against a term normalised by the same function.
That is what makes the same request return the same rows on PostgreSQL, MySQL
and SQL Server regardless of server collation — and it means the column has to
exist.

- `defineQueryRules` **refuses to build** if a `search` path has no
  `foldedField` (`Search field <path> declares no folded field`), and
  `assertOperatorSupported` refuses `ilike`/`notIlike` the same way
  (`Field <path> declares no folded field for ilike`). The application does not
  boot.
- `defineQuerySchema` refuses a folded companion that is not marked internal:
  `The folded field <path> of <model> must be declared internal`.
- Under the **TypeORM** adapter the name is a convention, not a choice: the
  resolver recognises the companion as `<field path>_folded` — over the **entity
  property name**, not the physical column. For `firstName` mapped to
  `first_name`, the property must be `firstName_folded` (the physical column can
  still be `first_name_folded`). Getting it wrong is not a warning: the declared
  schema stops matching the derived metadata and execution fails with
  `SOURCE_CONFIGURATION_INVALID`. The same resolver marks any property ending in
  `_folded` as internal automatically. Under Drizzle and Prisma the schema is
  declared rather than derived, so any name works as long as the declaration and
  the physical column agree (the examples use `nameFolded`).
- Your application fills the column on write, with the `foldText(value)` helper
  exported from the root — the exact function the core applies to the incoming
  term. See
  [`apps/examples/02-app-with-postgres/src/database/migrations/1731112260004-AddFoldedColumns.ts`](./apps/examples/02-app-with-postgres/src/database/migrations/1731112260004-AddFoldedColumns.ts)
  for add-column + backfill + index, and
  [`user.entity.ts`](./apps/examples/02-app-with-postgres/src/users/entities/user.entity.ts)
  for the `@BeforeInsert`/`@BeforeUpdate` listener. About that index: `like` and
  `search` compile to `contains`, i.e. `LIKE '%term%'`, which a plain b-tree
  index does not accelerate. What the folded column changes is that the
  comparison becomes a literal `LIKE` instead of `ILIKE`, so a plain index now
  serves **anchored** patterns; substring search still wants a trigram or
  full-text index. Not measured here.
- **`foldText` is `NFC` + `toLowerCase`. It does not strip diacritics.**
  `?search=eletrica` does **not** find "Elétrica". What folding buys you is that
  the case of the term does not change the result set — nothing more. If your v2
  endpoint relied on an accent-insensitive collation, that is an observable
  regression and you need a different strategy (a second, explicitly
  accent-stripped column of your own).

**Portable order columns.** `uuid` and `enum` do not order identically across
the three database families, so v3 will not order by them directly; it orders by
a `portableOrderField` you declare. Under TypeORM that companion follows the
same convention with the `_order` suffix (`<field path>_order`) and is likewise
auto-marked internal. Kinds that already have a total portable order — `string`,
`integer`, `bigint`, `decimal`, `boolean`, `date`, `datetime` — need nothing.

The trap is in the next section.

### Step 6 — things that stop the application from booting (or every request)

None of these are exotic; all three came out of migrating the example apps.

**A v2 `sorts` whitelist over an `enum` or `uuid` is now fatal at boot.**
`defineQueryRules` runs the portable-order check on every `sorts` entry, not
only on order filters. So a perfectly ordinary v2 line —

```ts
sorts: ['name', 'slug', 'status', 'createdAt']; // status is an enum
```

— fails when the module loads, with
`SOURCE_CONFIGURATION_INVALID: sorts.status: Field status has no portable total
order`. Either drop the path from `sorts` (what
[`modules.query.ts`](./apps/examples/02-app-with-postgres/src/modules/modules.query.ts)
did) or add a `portableOrderField` column for it.

**A `uuid` primary key needs a `portableOrderField` for _every_ request.** The
pagination tie-break is always appended over the full primary key, even when the
URL carries no `sort` at all. So with a `uuid` PK and no portable order column,
a bare `GET /posts` dies while the plan is built:

```
CAPABILITY_UNAVAILABLE: Primary key part id of post has no portable total order
```

This hits almost every Prisma consumer, because `@id @default(uuid())` is the
idiomatic Prisma default, and every Drizzle consumer using `uuid` PKs. The fix is
another column plus another backfill: see `posts.id_order` in
[`04-app-with-prisma/prisma/schema.prisma`](./apps/examples/04-app-with-prisma/prisma/schema.prisma)
and `idOrder` in
[`03-app-with-drizzle/src/db/tables.ts`](./apps/examples/03-app-with-drizzle/src/db/tables.ts).

**Sorting through a `many` relation is refused at construction.**
`sorts: ['posts.title']` fails with
`Sort posts.title crosses a many relation, which has no deterministic order`. In
v2 TypeORM accepted it and returned an arbitrary join row.

**The declared schema is checked field by field against the source.** Before
executing, the core compares your declared root schema with what the adapter
derives, and any difference is `SOURCE_CONFIGURATION_INVALID`. Compared:
`model`, `primaryKey`, and per field `kind`, `nullable`, `primaryKey`,
`foldedField`, `portableOrderField`, `internal`; per relation `target`,
`cardinality`, `nullable`. Only the **root** schema is compared — relation
schemas in the registry are not.

Two consequences that cost time on the TypeORM examples:

- The model name is derived, not chosen:
  `metadata.name.replace(/Entity$/, '').toLowerCase()`. `AccessRequestItem`
  becomes `accessrequestitem` — not `access_request_item`, not
  `accessRequestItem`. A mismatch surfaces on the first request as
  `Source model X does not match query rules model Y`.
- Relation nullability must match the derived value, and the derivation is
  `relation.isNullable || relation.isOneToMany`: a `OneToMany` collection is
  always `nullable: true`, and a `ManyToOne` over a `NOT NULL` FK must be
  `nullable: false`.

### Step 7 — ESM (`@nestjs/typeorm` 12)

`@nestjs/typeorm@12` is `"type": "module"` with no CommonJS entry. That kills the
`__dirname`-based globs every NestJS + TypeORM app has:

```diff
- entities: [path.join(__dirname, '/../**/*.entity{.ts,.js}')],
- migrations: [path.join(__dirname, '/migrations/*{.ts,.js}')],
+ entities: [User, Company, AccessRequest],
+ migrations: MIGRATIONS, // an explicit, ordered array
```

`__dirname` does not exist in ESM, so under an ESM runtime the app boots with
zero entities and zero migrations — no error, just an empty schema. All four
examples had to switch to explicit lists; see
[`database.module.ts`](./apps/examples/02-app-with-postgres/src/database/database.module.ts)
and
[`migrations.list.ts`](./apps/examples/02-app-with-postgres/src/database/migrations.list.ts).
Listing has a second benefit: a renamed entity breaks the build instead of the
boot.

### Step 8 — behaviour that changed on the wire

Retract the "Behavior is preserved 1:1" paragraph in the `1.0.0` section
below — **it does not apply to v3.**

<!-- prettier-ignore -->
> **Read this one first.** An unknown query parameter is now a `400`, not
> something the library ignores. v2 accepted anything it did not recognise; v3
> refuses with `QUERY_SYNTAX_UNKNOWN_PARAM` and names the offending key. The
> grammar is exactly eight parameters: `filter`, `sort`, `fields`, `includes`,
> `search`, `page`, `perPage`, `paginate`.
>
> This is the change most likely to produce a "worked in v2, 400s in v3"
> report, because the extra parameter usually does not come from your code:
> `?utm_source=…` from a campaign link, `?_=1699999999` from a jQuery
> cache-buster, a `?lang=` your own middleware appends. The endpoint used to
> return the list and quietly drop the key.
>
> If your endpoint legitimately takes its own parameters, do not hand the
> library `req.query` wholesale — pass only the grammar subset, which is what
> `@Query() query: DynamicQueryDto` gives you when the DTO is the parameter
> type.
>
> The reason it changed is the same one behind exact paths and typed coercion:
> the v3 core does not ignore input it was not asked about (design §5.6). A
> filter silently dropped is a page of results that is quietly wrong.

At minimum these change what your clients receive:

| Behaviour               | v2                                        | v3                                                                 |
| ----------------------- | ----------------------------------------- | ------------------------------------------------------------------ |
| Whitelist path matching | prefix — `company` allowed `company.name` | exact                                                              |
| Value coercion          | by text shape (`"00430123"` → `430123`)   | by declared field kind; bad input is `400 FILTER_VALUE_INVALID`    |
| `in=[]`                 | filter ignored, returns everything        | always-false condition, returns zero rows (`notIn=[]` always true) |
| Duplicate `sort`        | last/first/both, depending on adapter     | deduplicated; conflicting directions are `400 SORT_CONFLICT`       |
| `%` and `_` in patterns | wildcards                                 | literal characters (see the divergence section)                    |
| `defaultPerPage`        | `10`                                      | `20`                                                               |
| Primary key in the JSON | always injected                           | removed when not part of the visible projection                    |
| Error body              | `{ statusCode, message: "<prose>" }`      | stable envelope with a machine-readable `code`                     |
| Swagger decorator       | `@ApiDynamicQuery<T>(whitelists)`         | `@ApiDynamicQuery(compiledRules)`                                  |

Error bodies are now:

```jsonc
{
  "statusCode": 400,
  "code": "FIELD_NOT_ALLOWED",
  "message": "filter path is not allowed: secret",
  "details": { "path": "secret", "scope": "filter", "allowed": ["id", "name"] },
}
```

Branch on `code`, never on the message. `details` never echoes the value the
client sent. The full code list and the full coercion table are in
[`docs/v3/migration-from-v2.md`](./docs/v3/migration-from-v2.md) §4 and §8.

### Step 9 — your `search` whitelist can keep its relation paths

A `search` target that crosses relations compiles to a correlated `EXISTS`, the
same way a filter on that path does, so the page keeps the size you asked for
and `total` keeps counting roots. One hop or several, collection or
many-to-many: you do not have to restrict `search` to root paths.

Worth a paragraph of history, because a 2.x consumer may have hit both halves.
Until `3.0.0`, a `search` target crossing a `many` relation became a predicate
join, which duplicated root rows before `LIMIT` and silently returned a short
page — measured in example 02 against PostgreSQL, where `perPage=5` came back
with 4 rows out of 24 matching roots. And a path crossing **more than one**
relation, or a many-to-many, was refused outright by the TypeORM adapter while
Prisma and Drizzle compiled it. Both are closed: example 02 declares
`search: ['user.firstName', 'items.company.name']` again — a `one` hop and a
two-relation chain in the same `OR` — and its smoke E2E asserts the page length.
The corpus cases that hold the three adapters together are
`search/through-many-is-existential` and
`relation-many/chain-through-one-is-existential`.

The one rule that still constrains the whitelist: **every `search` target needs
a folded column, including through a relation.** That is why example 02 leaves
`items.company.cnpj` out — the field has none, and declaring it does not fail
the request, it fails **boot**, with
`Search field items.company.cnpj declares no folded field`.

### TypeORM specifics

Nothing in the ORM upgrade itself breaks (`^0.3.26 || ^1.0.0` both pass the
corpus). What you do:

1. `typeormSource(repository)` from `nestjs-rest-query/typeorm`.
2. Folded and portable-order companion properties named by the `_folded` /
   `_order` convention over the property path.
3. Explicit `entities` / `migrations` lists (ESM).

`buildSchemaRegistry(repository)` from the same subpath derives the whole
registry from the entity metadata, including transitively reachable relations,
and accepts a `fieldKinds` override for logical types the database cannot
express (a `char(36)` holding a UUID). It is only usable where a live repository
exists — i.e. inside a provider factory, not next to a decorator. **This helper
exists only in the TypeORM subpath.** The Drizzle counterpart is
`buildSourceSchema`, which derives the schema from the declared descriptor
rather than from the ORM; Prisma has no equivalent at all.

### Drizzle specifics

A 2.x consumer was on `0.45.x`, and the library range is
`>=1.0.0-rc.4 <1.0.0` — so this upgrade is mandatory. Four things break, none of
them mentioned by Drizzle's own release notes in a way you would connect to this
library:

1. **`drizzle(client, { schema })` no longer exists.** The 1.x signature leaves
   only `drizzle({ client })`. The `{ schema }` argument served the relational
   API (`db.query.*`), which the v3 adapter does not use.
2. **`relations()` was removed** from `drizzle-orm` (replaced by
   `defineRelations`). Under v3 the right answer is to delete those declarations:
   relations are declared on the logical descriptor instead, by dotted path.
3. **`declaration: true` + TypeScript 6 + `drizzle-orm` 1.x is TS2883.** The
   types `pgTable()` and `drizzle()` infer are not nameable from outside the
   package. An application does not publish types, so set
   `"declaration": false`. `skipLibCheck` does not help with this one (it is
   still needed for a different reason: `drizzle-orm@1.0.0-rc.4` errors inside
   its own `.d.cts` under TypeScript 6).
4. **`db.all()` only exists in the SQLite family.** PostgreSQL, MySQL and SQL
   Server expose `execute()`, and each returns a different shape. Which method
   to call comes from the dialect you declare, never from inspecting the object,
   so the dialect is a required argument.

Then the source itself. v2 handed the adapter Drizzle column objects; v3 takes a
logical descriptor and plain names:

| v2                                      | v3                                                            |
| --------------------------------------- | ------------------------------------------------------------- |
| `source.db` = the Drizzle `db`          | `drizzleDatabase({ client: db, dialect })`                    |
| `source.table` = a `pgTable`            | `createDrizzleTable({ name, model, columns })` (a descriptor) |
| `source.primaryKey` = a column          | `columns[x].primaryKey: true`                                 |
| `relations.x.table`                     | `relations.x.target` (another descriptor)                     |
| `relations.x.on: eq(a, b)`              | `relations.x.sourceColumn` + `.targetColumn`                  |
| `relations.x.primaryKey` (was required) | **removed**                                                   |
| —                                       | `relations.x.nullable` (required)                             |
| —                                       | `relations['x.y']` for deep hops                              |

```ts
// v3 — apps/examples/03-app-with-drizzle
import { drizzleDatabase, drizzleSource } from 'nestjs-rest-query/drizzle';

// once, in a module provider
drizzleDatabase({ client: db, dialect: 'postgres' });

// per request, in the service
await this.queryBuilderService.execute(
  drizzleSource({
    db: this.db, // the DrizzleDatabase, not the raw drizzle db
    dialect: 'postgres', // must match the executor; drizzleSource fails closed otherwise
    table: usersTable,
    relations: userRelations,
  }),
  query,
  rules
);
```

Build the rules registry with **`buildSourceSchema(table, relations)`** from the
same subpath — it is the function `drizzleSource` uses internally to describe the
source, so deriving from it removes the whole class of
`SOURCE_CONFIGURATION_INVALID` you would get from maintaining two descriptions
of one table:

```ts
export const USER_SCHEMAS: SchemaRegistry = new Map([
  ['user', buildSourceSchema(usersTable, userRelations)],
  ['company', buildSourceSchema(companiesTable, {})],
]);
```

Two more Drizzle-only constraints:

- **The logical column key is the SQL identifier.** The compiler emits the
  `columns` key through `sql.identifier(...)`; the `name` field on
  `DrizzleColumn` is declared but never read. A descriptor key that differs from
  the physical column name compiles, passes the source check, boots, and then
  fails in the database with `column "companyId" does not exist`. Keep key and
  physical name identical. Example 03 adds a startup assertion against
  `getTableColumns(pgTable)` to turn that into a boot error; it is a workaround
  for a library gap, not the intended design.
- **`drizzle-kit push`/`generate` cannot express the certified profile.** They
  do not emit `COLLATE "C"`, and code-point collation on portable text columns is
  part of the parity promise. Example 03 issues explicit DDL from
  [`src/database/bootstrap.ts`](./apps/examples/03-app-with-drizzle/src/database/bootstrap.ts)
  instead. See `test/profiles/` for the reference DDL per family.

### Prisma specifics

`prismaSource({ client })` takes the generated `PrismaClient` **directly** — no
cast, no adapter object of your own:

```ts
// prisma.service.ts — the client is a normal Nest provider
@Injectable()
export class PrismaService extends PrismaClient {}

// users.business.ts
return this.queryBuilderService.execute(
  prismaSource({ client: this.prisma, model: 'user', manifest }),
  query,
  rules
);
```

This is worth stating because it was not true until `3.0.0`: `client` used to be
typed `Readonly<Record<string, PrismaDelegate>>`, and no real `PrismaClient`
satisfied it — a class gets no implicit string index signature in TypeScript, so
every consumer needed an assertion, against the "no cast in documented usage"
gate. The delegate named by your manifest is now validated at source
construction and fails with `SOURCE_CONFIGURATION_INVALID` if it is missing or
is not a delegate, which is a check a type could never do here: the delegate
name comes from data, not from code.

The matrix target is Prisma `7.8.0` (CLI and client on the same version), with
the official driver adapter per dialect. `^6.19.0` stays in range, but if you go
to 7.x, six things change and none is optional:

1. **`url` left `datasource`.** Keeping the v2 schema fails generation with
   `P1012: The datasource property 'url' is no longer supported in schema files`.
   Connection URLs for CLI/Migrate move to `prisma.config.ts`; the client gets
   its connection from a driver adapter.
2. **The generator changed.** `provider = "prisma-client-js"` becomes
   `prisma-client`, with `output` and `moduleFormat` **required**, and the client
   stops existing at `@prisma/client`:
   `import { PrismaClient } from '@prisma/client'` becomes
   `TS2305: Module '"@prisma/client"' has no exported member 'PrismaClient'`.
   Every client import changes path.
3. **`new PrismaClient()` needs a driver adapter.** Add the adapter for your
   dialect on the client's major (`@prisma/adapter-pg` here) plus the driver
   (`pg`), and pass
   `{ adapter: new PrismaPg({ connectionString }) }` to the constructor.
4. **The generated client is real TypeScript**, not `.d.ts`. Generating outside
   the build `rootDir` breaks `nest build` with
   `TS6059: File '.../generated/prisma/client.ts' is not under rootDir`. Generate
   inside `src` (`output = "../src/generated/prisma"`).
5. **The Prisma 7 runtime loads through dynamic `import()`**, so any Jest runner
   that touches it needs `NODE_OPTIONS=--experimental-vm-modules`. Note that the
   ESM recipe used by examples 01–03 (`useESM: true` +
   `extensionsToTreatAsEsm`) **fails** against the generated client with
   `ReferenceError: exports is not defined`. What works is ts-jest in CommonJS
   **plus** the flag — see
   [`04-app-with-prisma/test/jest-e2e.json`](./apps/examples/04-app-with-prisma/test/jest-e2e.json).
6. **`.env` is no longer read by Prisma** (a consequence of 1): load `dotenv`
   and validate `DATABASE_URL` yourself.

Then the source. v2 built a `PrismaSource` inline, per request. v3 replaces it
with three artefacts, and there is no tool that derives them — the generator that
would read `schema.prisma` is a declared gap for `3.1.0`:

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
// v3, artefact 1 — the logical schema of every reachable model
// apps/examples/04-app-with-prisma/src/query/schemas.ts
export const APP_SCHEMAS: SchemaRegistry = new Map([
  ['company', companySchema],
  ['user', userSchema],
  ['post', postSchema],
]);

// v3, artefact 2 — the manifest, written by hand
// apps/examples/04-app-with-prisma/src/query/manifest.ts
import { createPrismaManifest } from 'nestjs-rest-query/prisma';

export const APP_MANIFEST: PrismaManifest = createPrismaManifest({
  provider: 'postgresql', // decides the dialect, and with it the pattern escape
  registry: APP_SCHEMAS,
  models: {
    company: { delegate: 'company' }, // maps the model to prisma.company
    user: { delegate: 'user' },
    post: { delegate: 'post' },
  },
});

// v3, artefact 3 — the per-endpoint rules, then the call
await this.queryBuilderService.execute(
  prismaSource({ client: this.prisma, model: 'user', manifest: APP_MANIFEST }),
  query,
  rules
);
```

`createPrismaManifest` validates the manifest against itself at startup: a model
with no registry entry or no `delegate` fails with
`SOURCE_CONFIGURATION_INVALID`. What it does **not** validate is the other
direction. `PrismaAdapter.describe()` returns the manifest's schema verbatim, so
**nothing checks your logical schema against `schema.prisma` or against the
database**: a mistyped field name surfaces as a Prisma error on the first request
that touches it, where the TypeORM path would have failed at boot. The
"missing metadata fails closed" guarantee does not extend to Prisma.

Field `path` in a Prisma logical schema is the **client property name**, not the
column name — it is what goes into the `where`/`select`/`orderBy` the adapter
builds. With `@map("name_folded")` in the schema, the HTTP API stays camelCase
while the database keeps the certified profile's snake_case.

---

## From `@multitechbr/nestjs-dynamic-query-builder` to `nestjs-rest-query`

This library was previously published as
`@multitechbr/nestjs-dynamic-query-builder` on a private registry. It has been
renamed and released as the public, MIT-licensed `nestjs-rest-query` on npm.

### Install

```bash
pnpm remove @multitechbr/nestjs-dynamic-query-builder
pnpm add nestjs-rest-query
```

You can also remove the legacy `.npmrc` configuration that was required to
access the private registry - it is no longer needed.

### Imports

In the **first 1.0.0 release** the package name changes but the public API
identifiers remain the same as in `4.x`. Replace only the import path:

```diff
- import { DynamicQueryBuilderModule } from '@multitechbr/nestjs-dynamic-query-builder';
+ import { DynamicQueryBuilderModule } from 'nestjs-rest-query';
```

### Behavior

**This paragraph is about the `4.x` → `1.0.0` rename only. It does not hold for
`3.x` — see [Step 8](#step-8--behaviour-that-changed-on-the-wire).**

Across the rename, behavior is preserved 1:1. Whitelist semantics, all 14
operators, pagination shape, sort/field/include/search handlers, Swagger
integration — all unchanged.

### Public API rename: cancelled

Earlier revisions of this guide announced that a future major would rename the
public surface to `RestQueryModule` / `RestQueryService` / `RestQueryRules` /
`RestQueryResult` / `RestQueryDto` and friends. **That never shipped and is no
longer planned.** The `3.x` major kept the `DynamicQuery*` names and changed the
shapes instead; the accurate map is
[The real name map](#the-real-name-map). No `RestQuery*` identifier exists in
any published version.

### License

Changed from ISC (internal) to **MIT** (public).

### Reporting issues during migration

If anything broke after the upgrade, open an issue:
https://github.com/naldomadeira/nestjs-rest-query/issues

## 1.x → 2.x

### Breaking — peer dependencies

- `typeorm` is now an **optional** peer dependency. If you were relying on it
  being pulled in transitively, install it explicitly: `pnpm add typeorm`.
- `drizzle-orm` is an **optional** peer dependency. Install only if you use the
  Drizzle adapter.

### Breaking — Drizzle adapter contracts (2.x only)

> These contracts describe the **2.x** Drizzle adapter. v3 replaced the source
> shape entirely — see [Drizzle](#drizzle-specifics) above.

The Drizzle adapter has explicit, runtime-enforced constraints. None of these
affect TypeORM users.

1. **`relations[*].cardinality: 'many'` requires `primaryKey`.** The TypeScript
   discriminated union catches it at compile time; the adapter's
   `createQueryBuilder` re-checks at runtime and throws:

   > DrizzleAdapter: relation "posts" has cardinality 'many' but no primaryKey.
   > 'many' relations require relations["posts"].primaryKey for deduplication. If
   > this is a 1:1 relation, change cardinality to 'one' (or omit it).

2. **ORDER BY a column reached through a `'many'` relation is not supported.**
   Calling the adapter with `?sorts=posts.createdAt` (where `posts` is
   `cardinality: 'many'`) throws:

   > Cannot sort by 'posts.createdAt': sorting through to-many relations is not
   > supported.

   This rules out a sort pattern that has no well-defined SQL semantics under
   the two-phase pagination strategy. Workaround: use the `customize` hook to
   add ordering of relation arrays in your application layer after the adapter
   has produced its rows.

3. **Result shape is flat — TypeORM-compatible.** Root columns are at the top
   level; relations are nested as keys at the same level: object for
   `cardinality: 'one'` (or `null` if the LEFT JOIN found no match) and array for
   `cardinality: 'many'` (deduplicated by `relation.primaryKey`, possibly empty).
   No deep nesting of relations-of-relations.

   ```json
   {
     "id": "u_1",
     "name": "Ana",
     "email": "ana@acme.com",
     "company": { "id": "c_1", "name": "Acme" },
     "posts": [{ "id": "p_1", "title": "Hello" }]
   }
   ```

   `rules.alias` does not affect the response shape (it remains useful for
   logging and error messages).

   Caveat: if a root column has the same name as a relation key, the relation
   overwrites the column. Avoid at schema design time.

### New

- `DrizzleAdapter` available via `nestjs-rest-query/drizzle`.
- Subpath exports — bundle size shrinks for single-ORM consumers.

### No code changes required (TypeORM users)

If you were using TypeORM with the default `forRoot()`, no application code
changes. The default adapter is still TypeORM. The `paginate=false` branch keeps
returning `{ data }` exactly as before.

## Intentional adapter divergences (parity)

The library aims for behavioral parity across TypeORM, Drizzle, and Prisma. A
divergence — same input, different observable outcome by adapter — is allowed
only where the underlying SQL/ORM model makes "the same as TypeORM" either
ambiguous or unsafe.

In v3 each divergence is declared as **data, on the case itself**, in
`tests/v3/corpus/cases.ts`, with a mandatory `reason` and the dialects it applies
to. The adapter's contract test compares against the divergent expectation with
the same rigor it applies to the canonical one, so an adapter that starts
agreeing again breaks the build and forces the divergence to be deleted.
`tests/v3/corpus/corpus.spec.ts` keeps an inventory of every declared
divergence, so a new one cannot slip in unreviewed.

**There is exactly one declared divergence in v3**, below.

### Prisma pattern operators, by provider

Under the v3 grammar `%`, `_` and `\` are literal characters:
`filter[name][like]=100%` searches for the text "100%". TypeORM and Drizzle emit
`LIKE ... ESCAPE`, so they honour it directly.

Prisma compiles `contains` to `LIKE ('%' || ? || '%')` with **no `ESCAPE`
clause**, and the typed delegate exposes no way to supply one. All that is left
is the dialect's default escape character, which splits the providers in two:

| `provider`            | `like`, `notLike`, `ilike`, `notIlike`, `search`                     | Why                                                                                                     |
| --------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `postgresql`, `mysql` | **Work, and `%`/`_` are literal** — identical to TypeORM and Drizzle | `\` is the dialect's default `LIKE` escape, so escaping the value is enough                             |
| `sqlite`, `sqlserver` | **Refused: `400 CAPABILITY_UNAVAILABLE`**                            | no default escape character, so literalness cannot be honoured; refusing beats returning the wrong rows |

This is [ADR-001](./docs/superpowers/specs/2026-09-04-v3-adr-001-matriz-e-escopo-da-3.0.0.md),
amendment 2, and it is what `PATTERN_ESCAPE` in
`src/infra/adapters/prisma/prisma.adapter.ts` encodes (`native` for postgres and
mysql, `unsupported` for sqlite and mssql).

Measured on Prisma `7.8.0` + PostgreSQL through
[`apps/examples/04-app-with-prisma`](./apps/examples/04-app-with-prisma):
`GET /posts?filter[title][like]=100%25` returns only "Desconto de 100% na conta
de luz", and `filter[title][like]=a_b` returns only "Circuito a_b revisado" — the
metacharacters are literal, as §11 requires.

If you are migrating a Prisma consumer on **SQL Server**, this is the breaking
part: five operators stop being available. Plan for it — see
[`docs/v3/versions.md`](./docs/v3/versions.md), "O que não é suportado".

### `?sort=<many-rel>.<column>` — no longer a divergence

In 2.x this was one: TypeORM accepted it (returning an arbitrary join row under
DISTINCT-like collapse) while Drizzle and Prisma rejected it with 400.

In v3 the core settles it before any adapter sees it, so all three behave
identically:

- the path is not in the endpoint's `sorts` whitelist →
  `400 FIELD_NOT_ALLOWED`, `sort path is not allowed: <path>`;
- you try to put it in `sorts` → `defineQueryRules` refuses at construction and
  the application does not boot
  (`Sort <path> crosses a many relation, which has no deterministic order`).

The legacy TypeORM acceptance is gone. To order a relation array inside each
row, use the `customize` hook after the adapter has produced its rows.

### Everything else

The remaining behaviors (filter operators, search, pagination shape,
`paginate=false`, customize hook, `isNull` on a `'one'` or `'many'` relation,
repeated filters, whitelist rejection, dotted-path filters) are exercised by the
parity corpus and produce identical outcomes across all three adapters,
including byte-for-byte 400 messages.
