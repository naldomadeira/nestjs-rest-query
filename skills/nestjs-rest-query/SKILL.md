---
name: nestjs-dynamic-query-builder
description: |
  Setting up, configuring, and using @multitechbr/nestjs-dynamic-query-builder in NestJS projects.
  Use when: installing the query builder, configuring filters/sorting/pagination, creating dynamic
  endpoints, setting up whitelist rules, integrating with TypeORM, troubleshooting query builder errors,
  adding Swagger support for dynamic queries.
  Keywords: dynamic query, filter, sort, pagination, TypeORM, NestJS, whitelist, RulesConfig,
  DynamicQueryDto, ApiDynamicQuery, QueryRules, query builder setup.
---

# nestjs-dynamic-query-builder

A NestJS library that adds dynamic filtering, sorting, pagination, field selection, relationship loading, and optional text search to TypeORM endpoints via query parameters.

**Package:** `@multitechbr/nestjs-dynamic-query-builder`
**Requires:** NestJS ^11, Node >= 20, TypeORM ^0.3.26
**Note:** Since `4.0.0`, the library supports optional native `search` via `RulesConfig.search`.

---

## Installation

### 1. Configure NPM Registry

Create or update `.npmrc` at project root:

```ini
@multitechbr:registry=https://gitlab.com/api/v4/packages/npm
//gitlab.com/api/v4/packages/npm/:_authToken=${CI_JOB_TOKEN}
//gitlab.com/api/v4/projects/73898570/packages/npm/:_authToken=${CI_JOB_TOKEN}
```

> For local development, replace `${CI_JOB_TOKEN}` with a GitLab Personal Access Token (scope: `read_api`).

### 2. Install Package

```bash
npm install @multitechbr/nestjs-dynamic-query-builder
# or: pnpm add / yarn add
```

### 3. Bootstrap Configuration (main.ts)

Three mandatory configurations in your `main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // REQUIRED: Extended query parser for filter[field][op]=value syntax
  app.set('query parser', 'extended');

  // REQUIRED: ValidationPipe with implicit conversion
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  await app.listen(3000);
}
bootstrap();
```

### 4. Register Module (app.module.ts)

The module is `@Global()` — register once, use everywhere:

```typescript
import { DynamicQueryBuilderModule } from '@multitechbr/nestjs-dynamic-query-builder';

@Module({
  imports: [
    DynamicQueryBuilderModule.forRoot(), // defaults: perPage=10, maxPerPage=100
  ],
})
export class AppModule {}
```

Optional configuration:

```typescript
DynamicQueryBuilderModule.forRoot({
  pagination: { defaultPerPage: 10, maxPerPage: 100 },
  operators: { allowed: ['eq', 'ne', 'like', 'ilike', 'in', 'between'] },
  logging: { enabled: false, level: 'info' },
})
```

→ Full setup details: [references/setup-reference.md](references/setup-reference.md)

---

## Basic Usage Pattern

### Controller

```typescript
import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiDynamicQuery,
  DynamicQueryDto,
  QueryRules,
  RulesConfig,
} from '@multitechbr/nestjs-dynamic-query-builder';

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
    @QueryRules() rules: RulesConfig,
  ) {
    return this.usersService.findAll(query, rules);
  }
}
```

### Service

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  QueryBuilderService,
  QueryInput,
  RulesConfig,
} from '@multitechbr/nestjs-dynamic-query-builder';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly queryBuilderService: QueryBuilderService,
  ) {}

  async findAll(query: QueryInput, rules: RulesConfig) {
    return this.queryBuilderService.execute(this.usersRepo, query, rules);
  }
}
```

---

## Decorators

| Decorator | Purpose | When to Use |
|-----------|---------|-------------|
| `@ApiDynamicQuery(rules)` | Sets whitelist + generates Swagger docs | Endpoints with Swagger |
| `@DynamicQuery(rules)` | Sets whitelist only | Endpoints without Swagger |
| `@QueryRules()` | Injects the whitelist into handler | Always pair with above |

---

## Query Parameters

| Parameter | Format | Example |
|-----------|--------|---------|
| `filter` | `filter[field][operator]=value` | `filter[status][eq]=active` |
| `sort` | CSV, `-` prefix = DESC | `sort=-createdAt,name` |
| `fields` | CSV of columns | `fields=id,name,email` |
| `includes` | CSV of relations | `includes=company,roles` |
| `search` | Free text | `search=john` |
| `page` | Number (default: 1) | `page=2` |
| `perPage` | Number (default: 10) | `perPage=25` |
| `paginate` | Boolean (default: true) | `paginate=false` |

### Filter Operators

13 operators available: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `like`, `ilike`, `notLike`, `notIlike`, `in`, `notIn`, `between`, `isNull`

→ Full operator reference with examples: [references/operators-reference.md](references/operators-reference.md)

---

## RulesConfig (Whitelist)

Every endpoint MUST declare which fields are queryable. This is the security model.

```typescript
@ApiDynamicQuery({
  filters: ['name', 'email'],      // Allowed filter fields
  sorts: ['name', 'createdAt'],    // Allowed sort fields
  fields: ['id', 'name', 'email'], // Allowed SELECT columns
  includes: ['company'],           // Allowed relations
  search: ['name', 'email'],       // Optional text search fields
})
```

**Critical rules:**
- Fields NOT in whitelist → **400 Bad Request** (never silently ignored)
- When `fields` is set, `sorts` fields MUST also be in `fields`
- Use entity/repository property names, not raw database column names
- Prefer `camelCase` property names when your entities follow that pattern
- Nested filtering: use dot notation — `filter[user.firstName][ilike]=ana`
- Nested fields require the parent relation in `includes`
- `search` is optional — only add `RulesConfig.search` when the endpoint needs a quick text search box
- Native `search` supports nested fields like `company.name` and `items.company.cnpj`
- In `customize`, if you write SQL manually as strings, using physical database column names is fine

→ Full whitelist reference: [references/rules-reference.md](references/rules-reference.md)

---

## Response Format

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

### Unpaginated (paginate=false)
```json
{
  "data": [...]
}
```

---

## Swagger Integration

When using `@ApiDynamicQuery`, add the request interceptor for filter testing in Swagger UI:

```typescript
import { dqbSwaggerRequestInterceptor } from '@multitechbr/nestjs-dynamic-query-builder';

SwaggerModule.setup('/', app, document, {
  swaggerOptions: { requestInterceptor: dqbSwaggerRequestInterceptor },
});
```

> The interceptor is only needed for Swagger UI browser testing. HTTP clients (Postman, curl) work without it.

---

## DO / DON'T

### DO
- Always set `app.set('query parser', 'extended')` in `main.ts`
- Always use `ValidationPipe` with `enableImplicitConversion: true`
- Always declare whitelist rules via `@ApiDynamicQuery` or `@DynamicQuery`
- Always pair decorator with `@QueryRules()` parameter decorator
- Use `customize` callback for server-side logic (soft deletes, tenant filtering)
- Use `ilike` for case-insensitive search (cross-database compatible)
- Keep `fields` and `sorts` in sync — sort fields must be in `fields` when `fields` is set
- Use entity property names from the TypeORM `Repository` / entity class, usually in `camelCase`
- Use native `search` when the endpoint needs simple text search across one or more allowed fields
- In `customize`, distinguish between entity property names in TypeScript and physical column names in manual SQL

### DON'T
- Don't skip the bootstrap steps — all three are mandatory
- Don't expose sensitive fields in whitelist (password, tokens, secrets)
- Don't use `like` for user-facing search — use `ilike` for case-insensitive
- Don't add fields to `sorts` that aren't in `fields` (when `fields` is defined)
- Don't use eager loading on entities — use `includes` parameter instead
- Don't bypass whitelist — it exists for security
- Don't assume every endpoint needs `search` — keep it optional and explicit in `RulesConfig`
- Don't use raw snake_case database column names in rules unless that is the actual entity property name

---

## Customize Callback — Server-Side Logic

The `customize` parameter on `execute()` is the escape hatch for anything the library does not cover natively. It gives full access to the TypeORM `SelectQueryBuilder` after all filters/includes/sorts are applied, but before pagination.

Use it for: soft deletes, tenant isolation, access control, non-standard search rules, additional joins, subqueries.

```typescript
// Soft delete + non-standard search across a relation
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
- The callback runs AFTER library filters/includes/sorts but BEFORE pagination
- Prefer native `RulesConfig.search` first; use `customize` only for search behavior the library does not cover
- Use `leftJoin` (not `leftJoinAndSelect`) for search-only joins — avoids loading unnecessary data
- Use unique aliases for customize joins (e.g., `search_cat` not `category`) to prevent conflicts with includes
- The callback is synchronous — resolve async data before calling `execute()`
- Cannot remove library-applied filters — use `buildQuery()` for full control

→ All 8 customize patterns with examples: [references/advanced-patterns.md](references/advanced-patterns.md)
→ Common errors and fixes: [references/troubleshooting.md](references/troubleshooting.md)

---

## Exports Summary

```typescript
// Core
import {
  DynamicQueryBuilderModule,
  QueryBuilderService,
} from '@multitechbr/nestjs-dynamic-query-builder';

// Decorators
import {
  ApiDynamicQuery,
  DynamicQuery,
  QueryRules,
  ApiPaginatedResponse,
} from '@multitechbr/nestjs-dynamic-query-builder';

// Types & DTOs
import {
  DynamicQueryDto,
  RulesConfig,
  QueryInput,
  QueryResult,
  QueryBuilderConfig,
} from '@multitechbr/nestjs-dynamic-query-builder';

// Swagger
import {
  dqbSwaggerRequestInterceptor,
} from '@multitechbr/nestjs-dynamic-query-builder';
```
