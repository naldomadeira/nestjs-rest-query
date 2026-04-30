<div align="center">

# nestjs-rest-query

**Declarative, whitelist-first REST query params for NestJS.**

Turn `?filters[email][like]=acme&sorts=-createdAt&page=2` into safe, typed database queries — without writing a single `WHERE` clause.

[![npm version](https://img.shields.io/npm/v/nestjs-rest-query.svg?style=flat-square)](https://www.npmjs.com/package/nestjs-rest-query)
[![npm downloads](https://img.shields.io/npm/dm/nestjs-rest-query.svg?style=flat-square)](https://www.npmjs.com/package/nestjs-rest-query)
[![CI](https://img.shields.io/github/actions/workflow/status/naldomadeira/nestjs-rest-query/ci.yml?branch=main&style=flat-square)](https://github.com/naldomadeira/nestjs-rest-query/actions/workflows/ci.yml)
[![Documentation](https://img.shields.io/badge/docs-naldomadeira.github.io%2Fnestjs--rest--query-2563eb?style=flat-square)](https://naldomadeira.github.io/nestjs-rest-query/)
[![License](https://img.shields.io/npm/l/nestjs-rest-query.svg?style=flat-square)](./LICENSE)
[![Bundle size](https://img.shields.io/bundlephobia/minzip/nestjs-rest-query?style=flat-square)](https://bundlephobia.com/package/nestjs-rest-query)

</div>

---

## Why?

NestJS has controllers. TypeORM has a query builder. The boilerplate between them — parsing query strings, validating fields, building filters, paginating, joining relations — is the same in every project.

`nestjs-rest-query` removes it. You declare a whitelist of what each endpoint accepts; the library handles the rest.

## Features

- 🎯 **Whitelist-first** — unknown query params are silently ignored. Defense by default.
- 🔍 **15 comparison operators** — `eq`, `ne`, `like`, `ilike`, `gt`, `gte`, `lt`, `lte`, `in`, `notIn`, `between`, `isNull`, `notNull`, `notLike`, `notIlike`.
- 📑 **Pagination** with `{ data, page, perPage, total, lastPage }`.
- ↕️ **Multi-field sorting** with `+`/`-` prefix.
- 🔗 **Relations on demand** via `?includes=`.
- ✂️ **Sparse fieldsets** via `?fields=`.
- 🔎 **Full-text search** across whitelisted columns.
- 📚 **Swagger/OpenAPI** integration — query params documented automatically.
- 🛡️ **Type-safe** end-to-end.
- 🪶 **Zero runtime dependencies** beyond your peers.

## Roadmap

| ORM     | Status         |
| ------- | -------------- |
| TypeORM | ✅ Stable      |
| Drizzle | ✅ Stable      |
| Prisma  | 🚧 Coming soon |

Want a different ORM? [Open a discussion](https://github.com/naldomadeira/nestjs-rest-query/discussions).

## Install

```bash
pnpm add nestjs-rest-query
# or
npm install nestjs-rest-query
```

Peer dependencies: `@nestjs/common`, `@nestjs/core`, `reflect-metadata`. Optionally `typeorm` (for TypeORM) or `drizzle-orm` (for Drizzle). Add `@nestjs/swagger` for OpenAPI integration (optional).

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
  ?filters[email][ilike]=%@acme.com
  &filters[createdAt][gte]=2025-01-01
  &sorts=-createdAt,name
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

All operators target a whitelisted column and use the `filters[<column>][<operator>]=<value>` syntax.

| Operator     | Example                                             | SQL equivalent                  |
| ------------ | --------------------------------------------------- | ------------------------------- |
| `eq`         | `filters[status][eq]=active`                        | `status = 'active'`             |
| `ne`         | `filters[status][ne]=archived`                      | `status <> 'archived'`          |
| `gt` / `gte` | `filters[age][gte]=18`                              | `age >= 18`                     |
| `lt` / `lte` | `filters[price][lt]=100`                            | `price < 100`                   |
| `like`       | `filters[name][like]=%souza%`                       | `name LIKE '%souza%'`           |
| `ilike`      | `filters[email][ilike]=%@acme.com`                  | `email ILIKE '%@acme.com'`      |
| `notLike`    | `filters[name][notLike]=%spam%`                     | `name NOT LIKE '%spam%'`        |
| `notIlike`   | `filters[email][notIlike]=%@spam.io`                | `email NOT ILIKE '%@spam.io'`   |
| `in`         | `filters[role][in]=admin,editor`                    | `role IN ('admin','editor')`    |
| `notIn`      | `filters[role][notIn]=guest`                        | `role NOT IN ('guest')`         |
| `between`    | `filters[createdAt][between]=2025-01-01,2025-12-31` | `createdAt BETWEEN ... AND ...` |
| `isNull`     | `filters[deletedAt][isNull]=true`                   | `deletedAt IS NULL`             |
| `notNull`    | `filters[deletedAt][notNull]=true`                  | `deletedAt IS NOT NULL`         |

Restrict the available operators globally via `forRoot({ operators: { allowed: ['eq', 'in', 'gte'] } })`.

## Sorting, fields, includes, search, pagination

```http
?sorts=name,-createdAt          # name ASC, createdAt DESC
?fields=id,name,email           # SELECT id, name, email
?includes=company,company.owner # LEFT JOIN company; LEFT JOIN owner
?search=keyword                 # against rules.search columns
?page=2&perPage=50              # offset/limit
```

Anything not declared in `RulesConfig` is ignored — clients can't sort by `password_hash` even if they try.

## Swagger / OpenAPI

Use `@ApiDynamicQuery(rules)` instead of `@DynamicQuery(rules)` and every query param shows up in your Swagger UI with the right type and description.

```typescript
import { dqbSwaggerRequestInterceptor } from 'nestjs-rest-query';

SwaggerModule.setup('docs', app, document, {
  swaggerOptions: { requestInterceptor: dqbSwaggerRequestInterceptor },
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

A future major release will rename these to `RestQueryModule`, `RestQueryService`, `@RestQuery`, etc. See [MIGRATION.md](./MIGRATION.md).

## Migration

If you used the internal `@multitechbr/nestjs-dynamic-query-builder`, see [MIGRATION.md](./MIGRATION.md). The behavior is identical; only the package name changes in 1.0.0.

## Contributing

PRs welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, branching, and the changeset workflow. By participating you agree to the [Code of Conduct](./CODE_OF_CONDUCT.md).

## License

[MIT](./LICENSE) © Naldo Madeira
