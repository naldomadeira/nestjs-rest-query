# Drizzle ORM Sample App

NestJS example demonstrating `nestjs-rest-query` with Drizzle ORM (skeleton).

## What's This?

This is a **placeholder implementation** of a NestJS + Drizzle ORM app that mirrors the structure of `02-app-with-postgres` (which uses TypeORM). The controllers, routes, and query string formats are identical to the TypeORM version, but the persistence layer uses Drizzle instead.

**Important**: The `DrizzleAdapter` integration (the bridge between nestjs-rest-query and Drizzle) is **not yet published**. All business logic currently returns stub responses with `TODO(2.0.0)` comments marking where the adapter will be wired in.

See [the Drizzle adapter plan](../../plans/orm-agnostic-and-drizzle/fase-02-drizzle-adapter.md) for implementation status.

## Quick Start

### Prerequisites

- Node.js >= 20
- pnpm
- Docker (for Postgres)

### Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Start the database
pnpm db:up

# 3. Copy environment variables
cp .env.example .env

# 4. Run schema migrations
pnpm db:push

# 5. Start the dev server
pnpm dev
```

The app will start on `http://localhost:3002`. Swagger docs are available at `http://localhost:3002/`.

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
curl "http://localhost:3002/users?filters[email][ilike]=%@acme.com&page=1&perPage=10"

# Filter by company name (nested relation)
curl "http://localhost:3002/users?filters[company.name][eq]=Acme"

# Include posts (1:N pagination)
curl "http://localhost:3002/users?includes=posts&page=1&perPage=2"

# No pagination
curl "http://localhost:3002/users?paginate=false"

# Sort descending by creation date
curl "http://localhost:3002/users?sorts=-createdAt"

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
curl "http://localhost:3002/posts?filters[title][ilike]=%featured%"
curl "http://localhost:3002/posts?includes=user"
```

## Current Status

- ✅ NestJS module structure
- ✅ Drizzle schema (pgTable + relations)
- ✅ Controllers with `@ApiDynamicQuery` and `@QueryRules` decorators
- ✅ Business logic stubs with TODO markers
- ⏳ **DrizzleAdapter integration** (pending parallel work)

## Next Steps

Once `DrizzleAdapter` is published:

1. Import and register it in `AppModule`
2. Replace the stub `return { data: [], ... }` responses in business files with actual:
   ```typescript
   const source = {
     db: this.db,
     table: this.db.schema.users,
     primaryKey: 'id',
     relations: this.db.schema.usersRelations,
   };
   return this.queryBuilderService.execute(source, query, rules);
   ```
3. Run seeds or manual data insertion
4. Test query strings against live data

## Scripts

```bash
pnpm dev              # Start dev server
pnpm build            # Compile TypeScript
pnpm db:up            # Start Postgres container
pnpm db:down          # Stop Postgres container
pnpm db:push          # Run Drizzle schema migrations
pnpm db:generate      # Generate migration files
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
