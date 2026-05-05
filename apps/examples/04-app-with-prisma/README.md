# Prisma ORM Sample App

NestJS example demonstrating `nestjs-rest-query` with Prisma.

## What's This?

A NestJS + Prisma app that mirrors the structure of `02-app-with-postgres` (TypeORM) and `03-app-with-drizzle` (Drizzle). The controllers, routes, and query string formats are **identical** to the other examples — only the persistence layer differs.

`DynamicQueryBuilderModule` is configured with `PrismaAdapter`, and each business class builds a `PrismaSource` with `relations` so the adapter can translate dotted paths, search, sort, includes, fields, and pagination into native `findMany` / `count` calls.

## Layout note: `prisma/` at the project root

Unlike the Drizzle sample (which colocates the seed under `src/database/`), this app keeps the schema and seed under a top-level `prisma/` directory. That's where the Prisma CLI looks by default — fighting it would mean adding `--schema=...` flags to every script. The `prisma/` layout matches the convention every Prisma user already has muscle memory for.

## Quick Start

### Prerequisites

- Node.js >= 20
- pnpm
- Docker (for Postgres)

### Setup

```bash
pnpm install                # 1. dependencies
cp .env.example .env        # 2. environment (DATABASE_URL)
pnpm db:up                  # 3. start Postgres in Docker
pnpm db:setup               # 4. db push + generate client + seed
pnpm dev                    # 5. start the API
```

App: `http://localhost:3003` · Swagger: `http://localhost:3003/`.

To re-seed (wipes and reinserts):

```bash
pnpm seed:reset
```

## Database

Postgres 16 on `localhost:5434` (use `pnpm db:down` to stop).

### Schema

Three tables (see `prisma/schema.prisma`):

- `companies`: id, name, created_at
- `users`: id, name, email, company_id (FK, nullable), created_at
- `posts`: id, title, content, user_id (FK), created_at

Relations:

- Company 1:N Users
- User 1:N Posts

## API Endpoints

The same query string as the TypeORM and Drizzle samples works here. A few highlights:

```bash
# All users, paginated
curl "http://localhost:3003/users?page=1&perPage=10"

# Filter by company name (Prisma wraps in nested where)
curl "http://localhost:3003/users?filter[company.name][eq]=Acme%20Corp"

# Filter through a 'many' relation (Prisma wraps in `some`)
curl "http://localhost:3003/users?filter[posts.title][ilike]=hello"

# Include posts (Prisma returns `posts: [...]` natively)
curl "http://localhost:3003/users?includes=posts&page=1&perPage=2"

# fields + includes: company is reduced to its PK only
curl "http://localhost:3003/users?fields=name&includes=company"

# Opt in to a relation scalar:
curl "http://localhost:3003/users?fields=name,company.name&includes=company"

# Sort through a 'one' relation (allowed)
curl "http://localhost:3003/users?sort=-company.name"

# Sort through a 'many' relation → 400
curl "http://localhost:3003/users?sort=-posts.createdAt"
```

See `src/http/*.http` for the full set of fixtures.

## Architecture

- **`AppModule`** registers `DynamicQueryBuilderModule.forRoot({ adapter: new PrismaAdapter(), ... })`. Every request goes through the same service, regardless of ORM.
- **`PrismaService`** extends `PrismaClient` and is provided globally via `PrismaModule`.
- **Business services** build a `PrismaSource` per request: `{ prisma, model, primaryKeyField, relations }`, then call `queryBuilderService.execute(source as never, query, rules)`.
  - `as never` is a deliberate cast: `QueryBuilderService` is generically typed against `ObjectLiteral` (TypeORM) at the type level. Runtime is adapter-agnostic, but TypeScript needs the escape hatch until the typing rework lands. We use `as never` (not `as any`) so the cast is grep-able.

## Differences from the TypeORM/Drizzle adapters

These come from Prisma's data model and are documented in the library's adapter page:

- `like` / `ilike` are **literal substring matches** in Prisma. `%` and `_` are not wildcards.
- `ilike` requires a Prisma provider that supports `mode: 'insensitive'`. Postgres (this sample) and MongoDB do; **SQLite does not** — restrict `OperatorsConfig.allowed` to omit `ilike` if you target SQLite.
- `isNull` translation differs by leaf kind: scalars use `{ not: null }`, relations use `{ isNot: null }`. The adapter handles this automatically based on `PrismaSource.relations` metadata.
- The adapter always stacks repeated filters under a top-level `where.AND: [...]`. This is equivalent to merged objects in most cases but visually different in Prisma's query log.

## Scripts

```bash
pnpm dev              # Start dev server
pnpm build            # Compile TypeScript
pnpm db:up            # Start Postgres container
pnpm db:down          # Stop Postgres container
pnpm db:push          # Apply schema (prisma db push --force-reset --skip-generate)
pnpm db:generate      # Generate the Prisma client
pnpm db:setup         # Convenience: db:push && db:generate && seed
pnpm seed             # Insert deterministic sample data
pnpm seed:reset       # Wipe and re-seed
```

## Conventions

- Controllers use `@ApiDynamicQuery(rules)` for OpenAPI integration
- Business services accept `DynamicQueryDto` and `RulesConfig`, return `QueryResult<T>`
- Prisma client is injected via `PrismaService` (extends `PrismaClient`)
- Path alias `@app/*` resolves to `src/*`

## See Also

- Parent library: [nestjs-rest-query](../../)
- TypeORM example: `02-app-with-postgres`
- Drizzle example: `03-app-with-drizzle`
