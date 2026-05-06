---
'nestjs-rest-query': minor
---

refactor(adapters): centralize 400 error messages (G7, parity gap)

All `BadRequestException` messages emitted by adapters, handlers, and normalizers now come from a single source of truth in `src/contracts/error-messages.ts` (also exposed as `ErrorMessages` namespace from the package root). The same logical error now produces the same byte-for-byte message regardless of which adapter (TypeORM, Drizzle, or Prisma) is wired up.

User-visible wording changes:

- Drizzle adapter messages no longer carry the `DrizzleAdapter:` prefix.
- The Drizzle "ORDER BY a column from 'many' relation" message is now the shorter `Cannot sort by '<path>': sorting through to-many relations is not supported.`, matching the Prisma adapter.
- `Invalid filter field name:` becomes `Invalid filter field format:` to align with the existing `Invalid <scope> field format:` wording used elsewhere.
- Prisma's `Include path(s) not allowed` becomes `Include(s) not allowed` to match the handler form.
- The `Unknown relation '<hop>'` message no longer mentions a specific adapter (e.g. `PrismaSource.relations`); it now says `Declare it in source.relations.`

Consumers parsing `error.message` should switch to importing the templates from `import { ErrorMessages } from 'nestjs-rest-query'` (or compare against well-known substrings).
