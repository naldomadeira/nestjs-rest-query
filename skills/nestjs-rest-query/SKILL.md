---
name: nestjs-rest-query
description: |
  Installing, configuring, using, upgrading and troubleshooting nestjs-rest-query (2.x and 3.x) in NestJS
  with TypeORM, Prisma or Drizzle.
  Use when: setting up the library, writing a list endpoint with filter/sort/pagination/fields/includes/search,
  declaring whitelist rules (RulesConfig in 2.x; defineQuerySchema + defineQueryRules in 3.x), wiring
  typeormSource/prismaSource/drizzleSource, adding Swagger (ApiDynamicQuery, dqbSwaggerRequestInterceptor),
  migrating 2.x → 3.x, or debugging its 400/500 errors (FIELD_NOT_ALLOWED, PAGINATION_INVALID,
  SOURCE_CONFIGURATION_INVALID, QUERY_SYNTAX_UNKNOWN_PARAM).
---

# nestjs-rest-query

Turns REST query params into whitelisted ORM queries. Two public API lines exist,
and guidance for one **fails** on the other — so every task starts by pinning the
version.

## Step 1 — detect the version

Read the consumer's `package.json` (and the lockfile when the range is loose),
then confirm with the import style. Done when you can name the line **and** the
exact installed version.

| Signal                                                                                                                                                                                       | Line                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `"nestjs-rest-query": "^2…"`, or `latest`; `forRoot({ adapter })`, `RulesConfig`, `@ApiDynamicQuery<T>({ filters: […] })`, `execute(repository, …)`                                          | **2.x**                                                       |
| `"3.0.0-alpha…"` / `@alpha`; `defineQuerySchema`, `defineQueryRules`, `typeormSource()` / `prismaSource()` / `drizzleSource()` imported from `nestjs-rest-query/<orm>`, `execute(source, …)` | **3.x**                                                       |
| `@multitechbr/nestjs-dynamic-query-builder`                                                                                                                                                  | the pre-rename package: MIGRATION.md, "From `@multitechbr/…`" |

Mixed signals (a `3.x` package with `RulesConfig` code) mean an upgrade in
progress: treat it as a migration. No package yet: `latest` resolves to **2.x**
(stable); **3.x** is a prerelease under the `alpha` tag. State which one you are
installing and why before writing code.

`bash scripts/validate-setup.sh <project-root>` runs these checks and the
per-line bootstrap checks.

## Step 2 — follow the line's guide

- **2.x** → [`references/v2/guide.md`](references/v2/guide.md) (setup, `RulesConfig`,
  operators, `customize`, troubleshooting under `references/v2/`).
- **2.x → 3.x upgrade** → [`references/v3/migrating-from-v2.md`](references/v3/migrating-from-v2.md);
  the ordered path is `MIGRATION.md`, section "2.x → 3.x", in the library repo.
- **3.x** → the rest of this file, then the reference it points to.

## 3.x in one page

Four decisions explain the rest: **coercion comes from the declared field kind**
(`"10abc"` on an integer is a 400, `"00430123"` on a string stays a string);
**paths are exact** (authorising `brand` does not authorise `brand.name`);
**`ilike`/`search` compare a folded column**, never `ILIKE`; **missing metadata
fails closed**, at boot where possible.

Per model you write a **schema** (what the model is) and per endpoint **rules**
(what it authorises). The service takes a **source**, which picks the adapter:

```typescript
// app.module.ts — only shared policy; `adapter`/`operators` are refused here
DynamicQueryBuilderModule.forRoot({ pagination: { defaultPerPage: 10, maxPerPage: 100 } });

// product.schema.ts
export const productSchema = defineQuerySchema({
  model: 'product',
  primaryKey: ['id'],
  fields: [
    { path: 'id', kind: 'integer', nullable: false, primaryKey: true },
    { path: 'name', kind: 'string', nullable: false, primaryKey: false, foldedField: 'name_folded' },
    { path: 'name_folded', kind: 'string', nullable: false, primaryKey: false, internal: true },
    { path: 'price', kind: 'decimal', nullable: false, primaryKey: false },
  ],
  relations: [{ path: 'brand', target: 'brand', cardinality: 'one', nullable: false }],
});

// products.query.ts — compiled once, at import time; impossible rules fail at boot
export const productRules = defineQueryRules(
  new Map([['product', productSchema], ['brand', brandSchema]]),
  'product',
  {
    filters: [
      { path: 'name', operators: ['eq', 'ilike'] },
      { path: 'price', operators: ['gte', 'lte', 'between'] },
      { path: 'brand.name', operators: ['eq'] },
    ],
    sorts: ['name', 'price'],
    fields: { root: { allowed: ['id', 'name', 'price'], default: ['id', 'name'] } },
    includes: ['brand'],
    search: ['name'],
  },
);

// products.service.ts — one source per service (the schema check is cached per source)
this.source = typeormSource(repository); // from 'nestjs-rest-query/typeorm'
return this.queryBuilder.execute(this.source, query, rules);

// products.controller.ts
@Get()
@ApiDynamicQuery(productRules)
list(@Query() query: DynamicQueryDto, @QueryRules() rules: CompiledQueryRules) { … }
```

`main.ts` needs `app.set('query parser', 'extended')` (Express 5 defaults to
`simple`, and `filter[name][eq]` would never become an object).

Grammar: exactly `filter`, `sort`, `fields`, `includes`, `search`, `page`,
`perPage`, `paginate`. Any other query key is `400 QUERY_SYNTAX_UNKNOWN_PARAM` —
strip an endpoint's own params before `execute()`. `paginate=false` is capped
(default: `maxPerPage` rows; above it a `400`, never a truncated list).

### Where the detail lives

| Task                                                                                  | Read                                                                     |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Install, `main.ts`, `forRoot` options, Swagger wiring                                 | [`references/v3/setup.md`](references/v3/setup.md)                       |
| Schema fields, folded / portable-order columns, rules, per-endpoint pagination policy | [`references/v3/schema-and-rules.md`](references/v3/schema-and-rules.md) |
| Query syntax, operators per kind, coercion, pagination cap, error envelope and codes  | [`references/v3/query-grammar.md`](references/v3/query-grammar.md)       |
| `typeormSource` / `prismaSource` + manifest / `drizzleSource` + tables, `customize`   | [`references/v3/adapters.md`](references/v3/adapters.md)                 |
| An error, a 500, an empty/ignored filter, anything that "worked in 2.x"               | [`references/v3/troubleshooting.md`](references/v3/troubleshooting.md)   |

### Prerelease: check the installed alpha

`3.0.0-alpha.0` has known defects that later alphas fix (decimal/date filters,
TypeORM filters through `many` relations on snake_case columns, the Swagger
interceptor, unbounded `paginate=false`) and one still open everywhere
(`@Query() DynamicQueryDto` emptied by `ValidationPipe({ whitelist: true })`).
Before blaming the consumer's code for a 500 or an ignored filter, compare the
installed version with the table in
[`references/v3/troubleshooting.md`](references/v3/troubleshooting.md#known-defects-by-version).
