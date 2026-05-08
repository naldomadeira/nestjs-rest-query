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

| nestjs-rest-query | NestJS | TypeORM | Drizzle  | Prisma              | Node   |
| ----------------- | ------ | ------- | -------- | ------------------- | ------ |
| `2.1.x`           | `11.x` | `0.3.x` | `0.45.x` | `5.x \| 6.x \| 7.x` | `>=20` |
| `2.0.x`           | `11.x` | `0.3.x` | `0.45.x` | —                   | `>=20` |
| `1.x`             | `11.x` | `0.3.x` | —        | —                   | `>=20` |

## Adapters

| ORM     | Status    | Import path                 |
| ------- | --------- | --------------------------- |
| TypeORM | ✅ Stable | `nestjs-rest-query`         |
| Drizzle | ✅ Stable | `nestjs-rest-query/drizzle` |
| Prisma  | ✅ Stable | `nestjs-rest-query/prisma`  |

Want a different ORM? [Open a discussion](https://github.com/naldomadeira/nestjs-rest-query/discussions).

## Install

```bash
pnpm add nestjs-rest-query
# or
npm install nestjs-rest-query
```

Peer dependencies: `@nestjs/common`, `@nestjs/core`, `reflect-metadata`. Optionally `typeorm` (for TypeORM), `drizzle-orm` (for Drizzle), or `@prisma/client` (for Prisma). Add `@nestjs/swagger` for OpenAPI integration (optional).

### Choose your ORM

```typescript
// TypeORM (default)
import { DynamicQueryBuilderModule } from 'nestjs-rest-query';

DynamicQueryBuilderModule.forRoot({});

// Drizzle
import { DynamicQueryBuilderModule } from 'nestjs-rest-query';
import { DrizzleAdapter } from 'nestjs-rest-query/drizzle';

DynamicQueryBuilderModule.forRoot({
  adapter: new DrizzleAdapter(),
});

// Prisma
import { DynamicQueryBuilderModule } from 'nestjs-rest-query';
import { PrismaAdapter } from 'nestjs-rest-query/prisma';

DynamicQueryBuilderModule.forRoot({
  adapter: new PrismaAdapter(),
});
```

See [Adapters](/docs/adapters) for more.

## Quick start

### 1. Register the module

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { DynamicQueryBuilderModule } from 'nestjs-rest-query';

@Module({
  imports: [
    DynamicQueryBuilderModule.forRoot({
      pagination: { defaultPerPage: 20, maxPerPage: 100 },
    }),
  ],
})
export class AppModule {}
```

### 2. Declare rules and use the decorator

```typescript
// users.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ApiDynamicQuery,
  QueryRules,
  QueryBuilderService,
  RulesConfig,
  QueryInput,
} from 'nestjs-rest-query';
import { User } from './user.entity';

const rules: RulesConfig = {
  alias: 'user',
  filters: ['email', 'name', 'createdAt', 'status'],
  sorts: ['name', 'createdAt'],
  fields: ['id', 'name', 'email'],
  includes: ['company'],
  search: ['name', 'email'],
};

@Controller('users')
export class UsersController {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly qb: QueryBuilderService
  ) {}

  @Get()
  @ApiDynamicQuery(rules)
  list(@Query() query: QueryInput, @QueryRules() endpointRules = rules) {
    return this.qb.execute(this.users, query, endpointRules);
  }
}
```

### 3. Send a request

```http
GET /users
  ?filter[email][ilike]=%@acme.com
  &filter[createdAt][gte]=2025-01-01
  &sort=-createdAt,name
  &includes=company
  &fields=id,name,email
  &search=ana
  &page=1
  &perPage=20
```

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

| Operator     | Example                                            | SQL equivalent                  |
| ------------ | -------------------------------------------------- | ------------------------------- |
| `eq`         | `filter[status][eq]=active`                        | `status = 'active'`             |
| `ne`         | `filter[status][ne]=archived`                      | `status <> 'archived'`          |
| `gt` / `gte` | `filter[age][gte]=18`                              | `age >= 18`                     |
| `lt` / `lte` | `filter[price][lt]=100`                            | `price < 100`                   |
| `like`       | `filter[name][like]=%souza%`                       | `name LIKE '%souza%'`           |
| `ilike`      | `filter[email][ilike]=%@acme.com`                  | `email ILIKE '%@acme.com'`      |
| `notLike`    | `filter[name][notLike]=%spam%`                     | `name NOT LIKE '%spam%'`        |
| `notIlike`   | `filter[email][notIlike]=%@spam.io`                | `email NOT ILIKE '%@spam.io'`   |
| `in`         | `filter[role][in]=admin,editor`                    | `role IN ('admin','editor')`    |
| `notIn`      | `filter[role][notIn]=guest`                        | `role NOT IN ('guest')`         |
| `between`    | `filter[createdAt][between]=2025-01-01,2025-12-31` | `createdAt BETWEEN ... AND ...` |
| `isNull`     | `filter[deletedAt][isNull]=true`                   | `deletedAt IS NULL`             |

Restrict the available operators globally via `forRoot({ operators: { allowed: ['eq', 'in', 'gte'] } })`, or per endpoint with `RulesConfig.operators`.

```typescript
const rules: RulesConfig = {
  filters: ['name', 'status'],
  operators: { allowed: ['eq', 'ilike'] },
};
```

Endpoint rules take precedence over the global `forRoot` setting. Use `operators: {}` on a route to reset that route to all operators allowed.

## Sorting, fields, includes, search, pagination

```http
?sort=name,-createdAt           # name ASC, createdAt DESC
?fields=id,name,email           # SELECT id, name, email
?includes=company,company.owner # LEFT JOIN company; LEFT JOIN owner
?search=keyword                 # against rules.search columns
?page=2&perPage=50              # offset/limit
```

Anything not declared in `RulesConfig` is rejected with `400 Bad Request` for filters, sorts, and includes — clients can't sort by `password_hash` even if they try. Field selection stays restricted to the declared `fields` list.

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
    defaultPerPage: 20,
    maxPerPage: 100,
  },
  operators: {
    allowed: ['eq', 'ne', 'in', 'notIn', 'gte', 'lte', 'ilike'],
  },
  logging: {
    enabled: true,
    level: 'info',
    format: 'json', // or 'console'
  },
});
```

All fields are optional. Sane defaults apply.

## Security model

Whitelist-first is the primary defense. Consumers should still:

- Keep `RulesConfig` minimal — least privilege.
- Never expose internal columns (`password_hash`, internal flags) in `fields` or `sorts`.
- Layer auth/authz (NestJS guards) above the query.
- Enforce tenant scoping in the controller before calling `execute()`.

See [SECURITY.md](./SECURITY.md) for vulnerability reporting.

## API surface

| Export                                        | Purpose                                              |
| --------------------------------------------- | ---------------------------------------------------- |
| `DynamicQueryBuilderModule`                   | The dynamic module — call `.forRoot(config)`.        |
| `QueryBuilderService`                         | `buildQuery(repo, query, rules)` and `execute(...)`. |
| `@DynamicQuery(rules)`                        | Stores rules in metadata.                            |
| `@ApiDynamicQuery(rules)`                     | Same + Swagger decorators.                           |
| `@QueryRules()`                               | Parameter decorator — injects rules at runtime.      |
| `RulesConfig`, `QueryInput`, `QueryResult<T>` | Public types.                                        |

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
