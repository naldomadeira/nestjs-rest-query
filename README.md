<div align="center">

# nestjs-rest-query

**Declarative, whitelist-first REST query params for NestJS.**

Turn `?filter[email][like]=acme&sort=-createdAt&page=2` into safe, typed database queries — without writing a single `WHERE` clause.

[![npm version](https://img.shields.io/npm/v/nestjs-rest-query.svg?style=flat-square&logo=npm)](https://www.npmjs.com/package/nestjs-rest-query)
[![npm downloads](https://img.shields.io/npm/dm/nestjs-rest-query.svg?style=flat-square)](https://www.npmjs.com/package/nestjs-rest-query)
[![CI](https://img.shields.io/github/actions/workflow/status/naldomadeira/nestjs-rest-query/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/naldomadeira/nestjs-rest-query/actions/workflows/ci.yml)
[![OSSF Scorecard](https://api.scorecard.dev/projects/github.com/naldomadeira/nestjs-rest-query/badge?style=flat-square)](https://scorecard.dev/viewer/?uri=github.com/naldomadeira/nestjs-rest-query)
[![Provenance](https://img.shields.io/badge/published%20with-provenance-brightgreen?style=flat-square&logo=npm)](https://www.npmjs.com/package/nestjs-rest-query)
[![License](https://img.shields.io/npm/l/nestjs-rest-query.svg?style=flat-square)](./LICENSE)

</div>

---

## Why?

NestJS has controllers. TypeORM has a query builder. The boilerplate between them — parsing query strings, validating fields, building filters, paginating, joining relations — is the same in every project.

`nestjs-rest-query` removes it. You declare a whitelist of what each endpoint accepts; the library handles the rest.

## Features

- 🎯 **Whitelist-first** — unauthorized fields are rejected with `400 Bad Request`. Defense by default.
- 🔍 **14 comparison operators** — `eq`, `ne`, `like`, `ilike`, `notLike`, `notIlike`, `gt`, `gte`, `lt`, `lte`, `in`, `notIn`, `between`, `isNull`.
- 📑 **Pagination** with `{ data, page, perPage, total, lastPage }`.
- ↕️ **Multi-field sorting** with `+`/`-` prefix.
- 🔗 **Relations on demand** via `?includes=`.
- ✂️ **Sparse fieldsets** via `?fields=`.
- 🔎 **Full-text search** across whitelisted columns.
- 📚 **Swagger/OpenAPI** integration — query params documented automatically.
- 🛡️ **Type-safe** end-to-end.
- 🪶 **Zero runtime dependencies** beyond your peers.

## Compatibility

| nestjs-rest-query  | NestJS | TypeORM               | Drizzle               | Prisma                | Node   |
| ------------------ | ------ | --------------------- | --------------------- | --------------------- | ------ |
| `3.x` (prerelease) | `11.x` | `^0.3.26 \|\| ^1.0.0` | `>=1.0.0-rc.4 <1.0.0` | `^6.19.0 \|\| ^7.0.0` | `>=22` |
| `2.1.x`            | `11.x` | `0.3.x`               | `0.45.x`              | `5.x \| 6.x \| 7.x`   | `>=20` |
| `2.0.x`            | `11.x` | `0.3.x`               | `0.45.x`              | —                     | `>=20` |
| `1.x`              | `11.x` | `0.3.x`               | —                     | —                     | `>=20` |

The `3.x` row is what the prerelease requires, not a suggestion: Drizzle
`0.45.x` is **not** accepted by v3. **This README documents the `3.x` API.** If
you are on `2.1.x`, the upgrade path is
[MIGRATION.md, "2.x → 3.x"](./MIGRATION.md#2x--3x); the full v3 matrix lives in
[`docs/v3/versions.md`](./docs/v3/versions.md).

## Adapters

| ORM     | Status    | Import path                 |
| ------- | --------- | --------------------------- |
| TypeORM | ✅ Stable | `nestjs-rest-query/typeorm` |
| Drizzle | ✅ Stable | `nestjs-rest-query/drizzle` |
| Prisma  | ✅ Stable | `nestjs-rest-query/prisma`  |

> The three adapters share one semantic core and answer the same 74-case parity
> corpus against PostgreSQL, MySQL and SQL Server — nine cells, no skips. The
> adapter is chosen by the **source** you pass to `execute()`, not by `forRoot`.
>
> `3.x` is still a prerelease: `3.0.0-alpha.0` is on npm under the `alpha` tag,
> and stable `3.0.0` waits on one thing only — external validation of that alpha
> by a consumer outside this repo. The `drizzle-orm` peer is
> closed on the release candidates the matrix measured, so the `1.0.0` GA cannot
> satisfy it until a release of ours re-runs the nine cells — that is a
> deliberate refusal, not a missing feature
> ([ADR-001](./docs/superpowers/specs/2026-09-04-v3-adr-001-matriz-e-escopo-da-3.0.0.md),
> amendment 1). Per-cell state and declared gaps:
> [`docs/v3/status.md`](./docs/v3/status.md).

Want a different ORM? [Open a discussion](https://github.com/naldomadeira/nestjs-rest-query/discussions).

## Install

`3.x` is a prerelease, published under the `alpha` tag. The `latest` tag still
points at `2.1.0`, so the tag is required to get the API this README documents:

```bash
pnpm add nestjs-rest-query@alpha
# or
npm install nestjs-rest-query@alpha
```

Peer dependencies: `@nestjs/common`, `@nestjs/core`, `reflect-metadata`. Optionally `typeorm` (for TypeORM), `drizzle-orm` (for Drizzle), or `@prisma/client` (for Prisma). Add `@nestjs/swagger` for OpenAPI integration (optional).

### Choose your ORM

`forRoot` configures common policy only. There is no `adapter` option and no
implicit default — the adapter is decided per call, by the **source** you hand
to `execute()`:

```typescript
DynamicQueryBuilderModule.forRoot({
  pagination: { defaultPerPage: 10, maxPerPage: 100 },
  textProfile: 'portable-strict',
});

// The adapter comes from the source, imported from its own subpath.
// The root package loads no ORM peer at all.
import { typeormSource } from 'nestjs-rest-query/typeorm';
// or: drizzleSource from 'nestjs-rest-query/drizzle'
// or: prismaSource  from 'nestjs-rest-query/prisma'

await this.qb.execute(typeormSource(this.users), query, rules);
```

Coming from `2.x`, where the adapter was a `forRoot` option? Passing `adapter`
or `operators` is now **rejected at startup** with
`SOURCE_CONFIGURATION_INVALID`. See
[MIGRATION.md](./MIGRATION.md#2x--3x).

## Quick start

> Four runnable versions of this walkthrough — TypeORM, Postgres, Drizzle and
> Prisma — live under [`apps/examples/`](./apps/examples/). They compile in
> `strict` and are smoke-tested in CI against real databases.

### 1. Register the module

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { DynamicQueryBuilderModule } from 'nestjs-rest-query';

@Module({
  imports: [
    DynamicQueryBuilderModule.forRoot({
      pagination: { defaultPerPage: 10, maxPerPage: 100 },
    }),
  ],
})
export class AppModule {}
```

### 2. Declare rules and use the decorator

There are two declarations, and the split is the point: the **schema** says
what the model _is_; the **rules** say what _this endpoint_ authorizes. The same
schema serves endpoints with different authorizations.

```typescript
// users.query.ts
import {
  defineQuerySchema,
  defineQueryRules,
  type SchemaRegistry,
} from 'nestjs-rest-query';

const userSchema = defineQuerySchema({
  model: 'user',
  primaryKey: ['id'],
  fields: [
    { path: 'id', kind: 'integer', nullable: false, primaryKey: true },
    // `foldedField` is what makes `ilike` and `search` portable — see below.
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
    { path: 'email', kind: 'string', nullable: false, primaryKey: false },
    { path: 'createdAt', kind: 'datetime', nullable: false, primaryKey: false },
  ],
  relations: [
    { path: 'company', target: 'company', cardinality: 'one', nullable: true },
  ],
});

// The registry must hold every model reachable from the root — `company` is
// declared the same way, in its own `defineQuerySchema` call.
const SCHEMAS: SchemaRegistry = new Map([
  ['user', userSchema],
  ['company', companySchema],
]);

// Compiled and validated here, at startup — not on the first request.
export const userRules = defineQueryRules(SCHEMAS, 'user', {
  filters: [
    { path: 'email', operators: ['eq', 'ilike'] },
    { path: 'createdAt', operators: ['gte', 'lte', 'between'] },
    { path: 'company.name', operators: ['eq'] },
  ],
  sorts: ['name', 'createdAt'],
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

```typescript
// users.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ApiDynamicQuery,
  QueryRules,
  QueryBuilderService,
  DynamicQueryDto,
  type CompiledQueryRules,
  type NormalizedQueryResult,
} from 'nestjs-rest-query';
import { typeormSource } from 'nestjs-rest-query/typeorm';
import { User } from './user.entity';
import { userRules } from './users.query';

@Controller('users')
export class UsersController {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly qb: QueryBuilderService
  ) {}

  @Get()
  @ApiDynamicQuery(userRules)
  list(
    @Query() query: DynamicQueryDto,
    @QueryRules() rules: CompiledQueryRules
  ): Promise<NormalizedQueryResult<User>> {
    return this.qb.execute(typeormSource(this.users), query, rules);
  }
}
```

A bad path, a default outside `allowed`, an operator the field type cannot
support, or an ambiguous sort fails while `defineQueryRules` runs — so the
application refuses to boot instead of returning a wrong page later.

### 3. Send a request

```http
GET /users
  ?filter[email][ilike]=acme.com
  &filter[createdAt][gte]=2025-01-01T00:00:00Z
  &sort=-createdAt,name
  &includes=company
  &fields=id,name,email
  &search=ana
  &page=1
  &perPage=20
```

Two things that differ from `2.x` and bite quietly:

- **`%` and `_` are literal.** `ilike=acme.com` already means "contains"; writing
  `%@acme.com` would search for a name containing a percent sign.
- **The grammar is those eight parameters and nothing else.** A ninth key —
  `?utm_source=`, a cache-buster, a `?lang=` your middleware appends — is
  `400 QUERY_SYNTAX_UNKNOWN_PARAM`, not silently dropped. Pass the subset, which
  is what `@Query() query: DynamicQueryDto` already hands you.

### 4. Get a typed response

```json
{
  "data": [
    {
      "id": "u_1",
      "name": "Ana Souza",
      "email": "ana@acme.com",
      "company": { "id": "c_1", "name": "Acme" }
    }
  ],
  "page": 1,
  "perPage": 20,
  "total": 137,
  "lastPage": 7
}
```

That's the whole loop.

## Operators

All operators target a whitelisted column and use the `filter[<column>][<operator>]=<value>` syntax.

| Operator     | Example                                            | Meaning                                    |
| ------------ | -------------------------------------------------- | ------------------------------------------ |
| `eq`         | `filter[status][eq]=active`                        | `status = 'active'`                        |
| `ne`         | `filter[status][ne]=archived`                      | `status <> 'archived'`                     |
| `gt` / `gte` | `filter[age][gte]=18`                              | `age >= 18`                                |
| `lt` / `lte` | `filter[price][lt]=100`                            | `price < 100`                              |
| `like`       | `filter[name][like]=souza`                         | contains the literal text `souza`          |
| `notLike`    | `filter[name][notLike]=spam`                       | does not contain `spam`                    |
| `ilike`      | `filter[email][ilike]=acme.com`                    | contains, case-insensitive (folded column) |
| `notIlike`   | `filter[email][notIlike]=spam.io`                  | does not contain, case-insensitive         |
| `in`         | `filter[role][in]=admin,editor`                    | `role IN ('admin','editor')`               |
| `notIn`      | `filter[role][notIn]=guest`                        | `role NOT IN ('guest')`                    |
| `between`    | `filter[createdAt][between]=2025-01-01,2025-12-31` | inclusive range; exactly two values        |
| `isNull`     | `filter[deletedAt][isNull]=true`                   | `deletedAt IS NULL`                        |

**Patterns are literal.** `%`, `_` and `\` match themselves; the library picks
and escapes the escape character per dialect. `in=[]` compiles to an
always-false condition (zero rows), and `notIn=[]` to an always-true one.

**Operators are declared per field**, in the endpoint rules — there is no global
list:

```typescript
defineQueryRules(SCHEMAS, 'user', {
  filters: [
    { path: 'name', operators: ['eq', 'ilike'] },
    { path: 'status', operators: ['eq', 'in'] },
  ],
  // ...
});
```

An operator the field's type cannot support is refused when the rules are
compiled, not when a request arrives.

### Case-insensitive search is portable, and costs a column

Under the default `portable-strict` profile, `ilike`, `notIlike` and `search`
query a hidden **folded column** declared as `foldedField`, compared literally.
No `ILIKE`, no `mode: 'insensitive'`, no dependence on server collation — which
is what lets Prisma on MySQL and SQL Server return the same rows as TypeORM on
PostgreSQL.

Your application fills that column on write, with the exported helper:

```typescript
import { foldText } from 'nestjs-rest-query';

user.name_folded = foldText(user.name); // value.normalize('NFC').toLowerCase()
```

## Sorting, fields, includes, search, pagination

```http
?sort=name,-createdAt           # name ASC, createdAt DESC
?fields=id,name,email           # SELECT id, name, email
?includes=company,company.owner # LEFT JOIN company; LEFT JOIN owner
?search=keyword                 # against rules.search columns
?page=2&perPage=50              # offset/limit
```

Anything not declared in the compiled rules is rejected with `400 Bad Request`
for filters, sorts and includes — clients can't sort by `password_hash` even if
they try, and field selection stays inside the declared `fields` list.

**Paths are exact.** Authorizing `company` does _not_ authorize `company.name`;
declare each one. If you are migrating from `2.x`, review every whitelist — the
old prefix matching may have been exposing more than you intended.

## Swagger / OpenAPI

Use `@ApiDynamicQuery(rules)` instead of `@DynamicQuery(rules)` and every query param shows up in your Swagger UI with the right type and description.

```typescript
import { dqbSwaggerRequestInterceptor } from 'nestjs-rest-query';

SwaggerModule.setup('docs', app, document, {
  swaggerOptions: {
    requestInterceptor: dqbSwaggerRequestInterceptor(document),
  },
});
```

The interceptor lets users type filters in the Swagger UI form and forwards them in the wire format the parser expects.

## Configuration

```typescript
DynamicQueryBuilderModule.forRoot({
  pagination: {
    defaultPerPage: 10,
    maxPerPage: 100,
  },
  textProfile: 'portable-strict',
  consistency: 'eventual',
  logging: {
    enabled: true,
    level: 'info',
    redactValues: true,
  },
});
```

All fields are optional; the values above are the defaults, except `logging`,
which is off. `maxPerPage` is an upper bound, not a silent clamp: a larger
`perPage` is a `400`.

`adapter` and `operators` are **refused at startup** — the first is decided by
the source, the second by the endpoint rules.

## Security model

Whitelist-first is the primary defense. Consumers should still:

- Keep the endpoint rules minimal — least privilege, and paths are exact.
- Never expose internal columns (`password_hash`, internal flags) in `fields` or `sorts`.
- Layer auth/authz (NestJS guards) above the query.
- Enforce tenant scoping in the controller before calling `execute()`.

See [SECURITY.md](./SECURITY.md) for vulnerability reporting.

## API surface

| Export                                                    | Purpose                                                  |
| --------------------------------------------------------- | -------------------------------------------------------- |
| `DynamicQueryBuilderModule`                               | The dynamic module — call `.forRoot(config)`.            |
| `QueryBuilderService`                                     | `execute(source, query, rules, options?)`.               |
| `defineQuerySchema`                                       | Declares what a model is; returns a `QuerySchema`.       |
| `defineQueryRules`                                        | Compiles and validates an endpoint whitelist at startup. |
| `foldText`                                                | Fills folded columns on write: `NFC` + lowercase.        |
| `@DynamicQuery(rules)` / `@ApiDynamicQuery(rules)`        | Store rules in metadata; the second adds Swagger.        |
| `@QueryRules()`                                           | Parameter decorator — injects the compiled rules.        |
| `RestQueryError`, `RestQueryErrorCode`, `toHttpException` | The error envelope and its stable codes.                 |
| `DynamicQueryDto`                                         | The eight-parameter grammar, as a DTO.                   |
| `CompiledQueryRules`, `NormalizedQueryResult<T>`          | Public types.                                            |

Adapters live in their own subpaths and are the only exports that load an ORM
peer: `typeormSource` and `buildSchemaRegistry` from `nestjs-rest-query/typeorm`,
`prismaSource` from `/prisma`, `drizzleSource` and `drizzleDatabase` from
`/drizzle`.

Errors carry a machine-readable `code` — branch on that, never on the message:

```jsonc
{
  "statusCode": 400,
  "code": "FIELD_NOT_ALLOWED",
  "message": "filter path is not allowed: secret",
  "details": { "path": "secret" },
}
```

## Try a PR before it ships

Every pull request publishes a one-off preview release via [pkg.pr.new](https://pkg.pr.new). Install it with:

```bash
pnpm add https://pkg.pr.new/naldomadeira/nestjs-rest-query@<commit-or-pr>
```

## Supply chain

Releases are published with [npm provenance](https://docs.npmjs.com/generating-provenance-statements) via GitHub Actions Trusted Publishing — no long-lived `NPM_TOKEN`. Each release tarball can be cryptographically traced to the exact commit and workflow run that built it.

## Contributing

PRs welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, branching, and the changeset workflow. By participating you agree to the [Code of Conduct](./CODE_OF_CONDUCT.md).

## License

[MIT](./LICENSE) © Naldo Madeira
