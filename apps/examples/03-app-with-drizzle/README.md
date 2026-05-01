# Drizzle ORM Sample App

NestJS example demonstrating `nestjs-rest-query` with Drizzle ORM.

## What's This?

A NestJS + Drizzle ORM app that mirrors the structure of `02-app-with-postgres` (which uses TypeORM). The controllers, routes, and query string formats are **identical** to the TypeORM version — only the persistence layer differs. This is the value proposition of the adapter pattern: change the ORM, keep the API.

The `DynamicQueryBuilderModule` is configured with `DrizzleAdapter`, and each business class builds a `DrizzleSource` with `relations` and `primaryKey` so the adapter can auto-join, filter, search, sort, and paginate (including the two-phase strategy for 1:N relations like `users → posts`).

## Quick Start

### Prerequisites

- Node.js >= 20
- pnpm
- Docker (for Postgres)

### Setup

```bash
pnpm install            # 1. dependencies
cp .env.example .env    # 2. environment
pnpm db:up              # 3. start Postgres in Docker
pnpm db:push            # 4. apply schema (creates tables from src/db/schema.ts)
pnpm seed               # 5. populate sample data (5 companies + 17 users + 30 posts)
pnpm dev                # 6. start the API
```

App: `http://localhost:3002` · Swagger: `http://localhost:3002/`.

To re-seed (wipes and reinserts):

```bash
pnpm seed:reset
```

## Database

Postgres 16 on `localhost:5433` (use `pnpm db:down` to stop).

### Schema

Three tables:

- `companies`: id, name, created_at
- `users`: id, name, email, company_id (FK), created_at
- `posts`: id, title, content, user_id (FK), created_at

Relations:

- Company 1:N Users
- User 1:N Posts

## API Endpoints

### Users

```bash
# All users, paginated
curl "http://localhost:3002/users?page=1&perPage=10"

# Filter by email (ilike)
curl "http://localhost:3002/users?filter[email][ilike]=acme&page=1&perPage=10"

# Filter by company name (nested relation)
curl "http://localhost:3002/users?filter[company.name][eq]=Acme"

# Include posts (1:N pagination)
curl "http://localhost:3002/users?includes=posts&page=1&perPage=2"

# No pagination
curl "http://localhost:3002/users?paginate=false"

# Sort descending by creation date
curl "http://localhost:3002/users?sort=-createdAt"

# Select specific fields
curl "http://localhost:3002/users?fields=id,name,email"
```

### Companies

```bash
curl "http://localhost:3002/companies?page=1&perPage=10"
curl "http://localhost:3002/companies?includes=users"
```

### Posts

```bash
curl "http://localhost:3002/posts?page=1&perPage=10"
curl "http://localhost:3002/posts?filter[title][ilike]=featured"
curl "http://localhost:3002/posts?includes=user"
```

## Architecture

- **`AppModule`** registers `DynamicQueryBuilderModule.forRoot({ adapter: new DrizzleAdapter(), ... })` so the service delegates every query to Drizzle.
- **Business services** build a `DrizzleSource` per request: `{ db, table, primaryKey, relations }`, then call `queryBuilderService.execute(source, query, rules)`. The adapter auto-joins for any dotted path that appears in a filter/sort/include/search.
- **1:N relations** like `users → posts` are declared with `cardinality: 'many'` + `primaryKey`; the adapter activates two-phase pagination (distinct root ids → `IN(...)` data → client-side aggregation) so `data.length === perPage` and `total` reflect distinct users, never the inflated joined-row count.

## Scripts

```bash
pnpm dev              # Start dev server
pnpm build            # Compile TypeScript
pnpm db:up            # Start Postgres container
pnpm db:down          # Stop Postgres container
pnpm db:push          # Apply schema to the database (drizzle-kit push --force)
pnpm db:generate      # Generate SQL migration files
pnpm db:setup         # Convenience: db:push && seed
pnpm seed             # Insert deterministic sample data
pnpm seed:reset       # Wipe and re-seed (idempotent)
```

## Conventions

- Controllers use `@ApiDynamicQuery(rules)` for OpenAPI integration
- Business services accept `DynamicQueryDto` and `RulesConfig`, return `QueryResult<T>`
- Drizzle instance is injected via `DRIZZLE_INSTANCE` token
- Path alias `@app/*` resolves to `src/*`

## See Also

- Parent library: [nestjs-rest-query](../../)
- TypeORM example: `02-app-with-postgres`
- Docs app: `docs/`
