---
name: nestjs-rest-query
description: |
  Setting up, configuring, and using nestjs-rest-query in NestJS projects with TypeORM or Drizzle.
  Use when: installing the library, configuring filters/sorting/pagination, creating dynamic
  endpoints, defining whitelist rules, switching between TypeORM and Drizzle adapters,
  adding Swagger support for dynamic queries, troubleshooting query parsing errors.
  Keywords: nestjs-rest-query, REST query, dynamic query, filter, sort, pagination, TypeORM,
  Drizzle, NestJS, whitelist, RulesConfig, DynamicQueryDto, ApiDynamicQuery, QueryRules,
  TypeOrmAdapter, DrizzleAdapter.
---

# nestjs-rest-query

A NestJS library that turns REST query parameters into safe, whitelisted database queries against TypeORM or Drizzle. Handles filtering, sorting, pagination, field selection, relation includes, and optional full-text search.

**Package:** `nestjs-rest-query` (public on npm)
**Requires:** NestJS `^11`, Node `>= 20`, TypeORM `^0.3.26` or Drizzle `^0.45`
**Repo & docs:** https://github.com/naldomadeira/nestjs-rest-query · https://naldomadeira.github.io/nestjs-rest-query/

---

## Installation

### 1. Install the package

```bash
pnpm add nestjs-rest-query
# or
npm install nestjs-rest-query
```

Peer dependencies you must already have installed in your project:

- `@nestjs/common`, `@nestjs/core`, `reflect-metadata`
- One ORM: `typeorm` (default) **or** `drizzle-orm`
- Optional: `@nestjs/swagger` (only if using `@ApiDynamicQuery`)

### 2. Bootstrap configuration (`main.ts`)

Three mandatory configurations. Skipping any of them breaks query parsing:

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // REQUIRED: extended query parser for filter[field][op]=value syntax
  app.set('query parser', 'extended');

  // REQUIRED: ValidationPipe with implicit conversion
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    })
  );

  await app.listen(3000);
}
bootstrap();
```

### 3. Register the module (`app.module.ts`)

The module is `@Global()` — register once, use everywhere.

**TypeORM (default):**

```typescript
import { DynamicQueryBuilderModule } from 'nestjs-rest-query';

@Module({
  imports: [
    DynamicQueryBuilderModule.forRoot(), // defaults: defaultPerPage=10, maxPerPage=100
  ],
})
export class AppModule {}
```

**Drizzle:**

```typescript
import { DynamicQueryBuilderModule } from 'nestjs-rest-query';
import { DrizzleAdapter } from 'nestjs-rest-query/drizzle';

@Module({
  imports: [
    DynamicQueryBuilderModule.forRoot({
      adapter: new DrizzleAdapter(),
    }),
  ],
})
export class AppModule {}
```

Optional configuration (works with either adapter):

```typescript
DynamicQueryBuilderModule.forRoot({
  pagination: { defaultPerPage: 10, maxPerPage: 100 },
  operators: { allowed: ['eq', 'ne', 'like', 'ilike', 'in', 'between'] },
  logging: { enabled: false, level: 'info' },
  // adapter: new DrizzleAdapter(), // omit for TypeORM
});
```

→ Full setup details: [references/setup-reference.md](references/setup-reference.md)

---

## Basic usage pattern

### Controller

```typescript
import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiDynamicQuery,
  DynamicQueryDto,
  QueryRules,
  RulesConfig,
} from 'nestjs-rest-query';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiDynamicQuery({
    filters: ['name', 'email', 'status'],
    sorts: ['name', 'createdAt'],
    fields: ['id', 'name', 'email', 'status'],
    includes: ['company'],
  })
  async findAll(
    @Query() query: DynamicQueryDto,
    @QueryRules() rules: RulesConfig
  ) {
    return this.usersService.findAll(query, rules);
  }
}
```

### Service (TypeORM)

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  QueryBuilderService,
  QueryInput,
  RulesConfig,
} from 'nestjs-rest-query';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    private readonly queryBuilderService: QueryBuilderService
  ) {}

  async findAll(query: QueryInput, rules: RulesConfig) {
    return this.queryBuilderService.execute(this.usersRepo, query, rules);
  }
}
```

### Service (Drizzle)

```typescript
import { Injectable, Inject } from '@nestjs/common';
import {
  QueryBuilderService,
  QueryInput,
  RulesConfig,
  type DrizzleSource,
} from 'nestjs-rest-query';
import { users, companies } from './schema';
import { db } from './db';

@Injectable()
export class UsersService {
  constructor(private readonly queryBuilderService: QueryBuilderService) {}

  private readonly source: DrizzleSource = {
    db,
    table: users,
    relations: {
      company: {
        type: 'one',
        table: companies,
        on: { localKey: 'companyId', foreignKey: 'id' },
      },
    },
  };

  async findAll(query: QueryInput, rules: RulesConfig) {
    return this.queryBuilderService.execute(this.source, query, rules);
  }
}
```

The decorator/controller layer is **identical** for both ORMs. The only difference is what you hand to `execute()` — a TypeORM `Repository` or a `DrizzleSource` describing your table and relations.

---

## Decorators

| Decorator                 | Purpose                                 | When to use                |
| ------------------------- | --------------------------------------- | -------------------------- |
| `@ApiDynamicQuery(rules)` | Sets whitelist + generates Swagger docs | Endpoints with Swagger     |
| `@DynamicQuery(rules)`    | Sets whitelist only                     | Endpoints without Swagger  |
| `@QueryRules()`           | Injects the whitelist into the handler  | Always pair with the above |

---

## Query parameters

| Parameter  | Format                          | Example                     |
| ---------- | ------------------------------- | --------------------------- |
| `filter`   | `filter[field][operator]=value` | `filter[status][eq]=active` |
| `sorts`    | CSV, `-` prefix = DESC          | `sorts=-createdAt,name`     |
| `fields`   | CSV of columns                  | `fields=id,name,email`      |
| `includes` | CSV of relations                | `includes=company,roles`    |
| `search`   | Free text                       | `search=john`               |
| `page`     | Number (default: 1)             | `page=2`                    |
| `perPage`  | Number (default: 10)            | `perPage=25`                |
| `paginate` | Boolean (default: true)         | `paginate=false`            |

### Filter operators

14 operators available: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `like`, `ilike`, `notLike`, `notIlike`, `in`, `notIn`, `between`, `isNull`.

→ Full operator reference with examples: [references/operators-reference.md](references/operators-reference.md)

---

## RulesConfig (whitelist)

Every endpoint MUST declare which fields are queryable. This is the security model.

```typescript
@ApiDynamicQuery({
  filters: ['name', 'email'],      // Allowed filter fields
  sorts: ['name', 'createdAt'],    // Allowed sort fields
  fields: ['id', 'name', 'email'], // Allowed SELECT columns
  includes: ['company'],           // Allowed relations
  search: ['name', 'email'],       // Optional text search fields for ?search=
})
```

**Critical rules:**

- Fields NOT in whitelist → **400 Bad Request** (never silently ignored).
- When `fields` is set, every entry in `sorts` MUST also be in `fields`.
- Use entity/repository property names, not raw database column names. Prefer `camelCase` when your entities follow that convention.
- Nested filtering uses dot notation — `filter[user.firstName][ilike]=ana`.
- Nested fields require the parent relation in `includes`.
- `search` is optional; only declare `RulesConfig.search` when the endpoint needs a quick text search box. Native search supports nested paths like `company.name` and `items.company.cnpj`.
- In `customize` (TypeORM), if you write SQL manually as strings, physical column names are fine.

→ Full whitelist reference: [references/rules-reference.md](references/rules-reference.md)

---

## Response format

### Paginated (default)

```json
{
  "data": [...],
  "page": 1,
  "perPage": 10,
  "total": 42,
  "lastPage": 5
}
```

### Unpaginated (`paginate=false`)

```json
{
  "data": [...]
}
```

---

## Swagger integration

When using `@ApiDynamicQuery`, register the request interceptor so the Swagger UI form posts filters in the wire format the parser expects:

```typescript
import { dqbSwaggerRequestInterceptor } from 'nestjs-rest-query';

SwaggerModule.setup('/', app, document, {
  swaggerOptions: {
    requestInterceptor: dqbSwaggerRequestInterceptor(document),
  },
});
```

> The interceptor is only needed for Swagger UI browser testing. HTTP clients (Postman, curl, fetch) work without it.

---

## DO / DON'T

### DO

- Always set `app.set('query parser', 'extended')` in `main.ts`.
- Always use `ValidationPipe` with `enableImplicitConversion: true`.
- Always declare whitelist rules via `@ApiDynamicQuery` or `@DynamicQuery`.
- Always pair the decorator with `@QueryRules()` parameter decorator.
- Use `customize` callback (TypeORM) for server-side logic: soft deletes, tenant filtering, access control.
- Use `ilike` for case-insensitive search (cross-database compatible).
- Keep `fields` and `sorts` in sync — sort fields must be in `fields` when `fields` is set.
- Use entity property names from the TypeORM `Repository`/entity class, usually `camelCase`.
- Use native `search` when the endpoint needs simple text search across one or more allowed fields.
- For Drizzle, build your `DrizzleSource` once per module and reuse — it describes table + relations.

### DON'T

- Don't skip the bootstrap steps — all three are mandatory.
- Don't expose sensitive fields in the whitelist (passwords, tokens, secrets).
- Don't use `like` for user-facing search — use `ilike` for case-insensitive.
- Don't add fields to `sorts` that aren't in `fields` (when `fields` is defined).
- Don't use TypeORM eager loading on entities — use the `includes` parameter instead.
- Don't bypass the whitelist — it exists for security.
- Don't assume every endpoint needs `search` — keep it optional and explicit in `RulesConfig`.
- Don't use raw `snake_case` database column names in rules unless that is the actual entity property name.
- Don't try to mutate query rules dynamically per request through the decorator — use the controller-level `customize` callback for runtime logic.

---

## Customize callback — server-side logic (TypeORM)

The `customize` parameter on `execute()` is the escape hatch for anything the library does not cover natively. It gives full access to the TypeORM `SelectQueryBuilder` after all filters/includes/sorts are applied, but before pagination.

Use it for: soft deletes, tenant isolation, access control, non-standard search rules, additional joins, subqueries.

```typescript
// Soft delete + tenant scope + non-standard search across a relation
async findAll(
  query: DynamicQueryDto & { search?: string },
  rules: RulesConfig,
  tenantId: string,
) {
  return this.queryBuilderService.execute(
    this.productsRepo,
    query,
    rules,
    (qb) => {
      qb.andWhere('root.tenant_id = :tenantId', { tenantId });
      qb.andWhere('root.deleted_at IS NULL');

      if (query.search?.trim()) {
        const s = `%${query.search.trim()}%`;
        // Only needed when native RulesConfig.search is not enough
        qb.leftJoin('root.category', 'search_cat');
        qb.andWhere(
          '(root.name ILIKE :s OR search_cat.name ILIKE :s)',
          { s },
        );
      }
    },
  );
}
```

**Key rules:**

- The callback runs AFTER library filters/includes/sorts but BEFORE pagination.
- Prefer native `RulesConfig.search` first; use `customize` only for behavior the library does not cover.
- Use `leftJoin` (not `leftJoinAndSelect`) for search-only joins — avoids loading unnecessary data.
- Use unique aliases for customize joins (e.g., `search_cat` not `category`) to prevent conflicts with includes.
- The callback is synchronous — resolve async data before calling `execute()`.
- Cannot remove library-applied filters — use `buildQuery()` for full control.

> Drizzle does not currently support a `customize` callback. For ad-hoc Drizzle queries, build your own `db.select(...)` and apply business filters there, then merge with library results if needed.

→ All 8 customize patterns with examples: [references/advanced-patterns.md](references/advanced-patterns.md)
→ Common errors and fixes: [references/troubleshooting.md](references/troubleshooting.md)

---

## Exports summary

```typescript
// Core
import {
  DynamicQueryBuilderModule,
  QueryBuilderService,
} from 'nestjs-rest-query';

// Adapters (default is TypeORM; bring DrizzleAdapter explicitly)
import { TypeOrmAdapter, DrizzleAdapter } from 'nestjs-rest-query';
// Or import the Drizzle adapter via subpath when you only need that one
import { DrizzleAdapter } from 'nestjs-rest-query/drizzle';

// Decorators
import {
  ApiDynamicQuery,
  DynamicQuery,
  QueryRules,
  ApiPaginatedResponse,
} from 'nestjs-rest-query';

// Types & DTOs
import {
  DynamicQueryDto,
  PaginationQueryDto,
  RulesConfig,
  QueryInput,
  QueryResult,
  QueryBuilderConfig,
  type DrizzleSource,
} from 'nestjs-rest-query';

// Operators (constants you can use to restrict allowed operators)
import { Operator, ALL_OPERATORS, type QueryOperator } from 'nestjs-rest-query';

// Swagger
import { dqbSwaggerRequestInterceptor } from 'nestjs-rest-query';
```
