---
'nestjs-rest-query': minor
---

Introduce ORM-agnostic adapter pattern (Phase 1).

`forRoot()` now accepts an optional `adapter: RestQueryAdapter`. When omitted, the default `TypeOrmAdapter` is used and behavior is identical to `1.0.x` — including the `paginate=false` branch that returns `{ data }` without page/total.

This release adds:

- `RestQueryAdapter` interface — the contract any ORM adapter must satisfy.
- `TypeOrmAdapter` — wraps the existing handlers; lazy-requires `typeorm`.
- `QueryBuilderConfig.adapter` — optional, defaults to `new TypeOrmAdapter()`.

No application-level changes are required for existing TypeORM consumers. The `RestQueryAdapter` type and `TypeOrmAdapter` class are exported from the package root for users who want to compose or replace the adapter.

This is Phase 1 of the ORM-agnostic refactor. A real `DrizzleAdapter` and subpath exports (`nestjs-rest-query/typeorm`, `nestjs-rest-query/drizzle`) ship in `2.0.0` once `1.1.0` has baked. See `plans/orm-agnostic-and-drizzle/`.
