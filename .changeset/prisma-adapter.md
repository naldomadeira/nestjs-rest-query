---
'nestjs-rest-query': minor
---

Add `PrismaAdapter` exported from `nestjs-rest-query/prisma`. `@prisma/client` is now an optional peer dependency. The adapter implements the full `RestQueryAdapter` contract — filters, sorts, includes, search, fields (with root-PK auto-injection), pagination, and `customize` — and translates dotted relation paths through `'many'` hops with Prisma's `some` semantics. `select` and `include` are reconciled into a single `select` tree when both are needed at the same level. No changes to existing TypeORM or Drizzle behavior, no public-API changes.
