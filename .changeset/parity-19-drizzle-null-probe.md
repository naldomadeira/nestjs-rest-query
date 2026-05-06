---
'nestjs-rest-query': minor
---

feat(drizzle): support `?filter[<one-rel>][isNull]=true|false` via `nullProbeColumn`

`DrizzleRelationOne` gains a new optional `nullProbeColumn?: AnyColumn` field. When declared, the adapter can resolve `isNull` filters on a `'one'` relation by emitting `LEFT JOIN ... WHERE <nullProbeColumn> IS [NOT] NULL` — mirroring the behavior TypeORM has via metadata and Prisma has via `is`/`isNot`. If a consumer issues `filter[<rel>][isNull]` without declaring `nullProbeColumn`, the adapter throws a 400 with a clear message pointing to the missing config.

Migration: zero changes required for existing consumers. Add `nullProbeColumn: <table>.<pk>` to relations where you want to support the new filter.
