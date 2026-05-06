---
'nestjs-rest-query': minor
---

feat(drizzle,prisma): accept `?filter[<many-rel>][isNull]=true|false` (G3, Caminho B)

Both adapters now accept `isNull` on a `'many'` relation, with semantics equivalent to TypeORM's existing behavior:

- `=true` → roots with **zero** related rows.
- `=false` → roots with **at least one** related row.

Drizzle emits `LEFT JOIN <rel> ON ... WHERE <rel>.<primaryKey> IS [NOT] NULL`. Prisma uses `where: { <rel>: { none: {} } }` for `true` and `{ some: {} }` for `false`. The result set is identical across the three adapters; the previous 400 emitted by Prisma is gone, and Drizzle's previously untested path is now part of the parity matrix.

Migration: no consumer changes required. The previously thrown error message `Operator "isNull" is not supported on to-many relation "..."` is no longer emitted by any adapter. The associated `ErrorMessages.ISNULL_ON_MANY` template has been removed.
