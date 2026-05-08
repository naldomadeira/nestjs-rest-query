# Changelog

## 2.2.0

### Minor Changes

- [#33](https://github.com/naldomadeira/nestjs-rest-query/pull/33) [`102eb49`](https://github.com/naldomadeira/nestjs-rest-query/commit/102eb491feb1c8d611b53590cdef7ed3c09fe15a) Thanks [@naldomadeira](https://github.com/naldomadeira)! - feat(drizzle): support `?filter[<one-rel>][isNull]=true|false` via `nullProbeColumn`

  `DrizzleRelationOne` gains a new optional `nullProbeColumn?: AnyColumn` field. When declared, the adapter can resolve `isNull` filters on a `'one'` relation by emitting `LEFT JOIN ... WHERE <nullProbeColumn> IS [NOT] NULL` — mirroring the behavior TypeORM has via metadata and Prisma has via `is`/`isNot`. If a consumer issues `filter[<rel>][isNull]` without declaring `nullProbeColumn`, the adapter throws a 400 with a clear message pointing to the missing config.

  Migration: zero changes required for existing consumers. Add `nullProbeColumn: <table>.<pk>` to relations where you want to support the new filter.

- [#33](https://github.com/naldomadeira/nestjs-rest-query/pull/33) [`102eb49`](https://github.com/naldomadeira/nestjs-rest-query/commit/102eb491feb1c8d611b53590cdef7ed3c09fe15a) Thanks [@naldomadeira](https://github.com/naldomadeira)! - feat(drizzle,prisma): accept `?filter[<many-rel>][isNull]=true|false` (G3, Caminho B)

  Both adapters now accept `isNull` on a `'many'` relation, with semantics equivalent to TypeORM's existing behavior:
  - `=true` → roots with **zero** related rows.
  - `=false` → roots with **at least one** related row.

  Drizzle emits `LEFT JOIN <rel> ON ... WHERE <rel>.<primaryKey> IS [NOT] NULL`. Prisma uses `where: { <rel>: { none: {} } }` for `true` and `{ some: {} }` for `false`. The result set is identical across the three adapters; the previous 400 emitted by Prisma is gone, and Drizzle's previously untested path is now part of the parity matrix.

  Migration: no consumer changes required. The previously thrown error message `Operator "isNull" is not supported on to-many relation "..."` is no longer emitted by any adapter. The associated `ErrorMessages.ISNULL_ON_MANY` template has been removed.

- [#33](https://github.com/naldomadeira/nestjs-rest-query/pull/33) [`102eb49`](https://github.com/naldomadeira/nestjs-rest-query/commit/102eb491feb1c8d611b53590cdef7ed3c09fe15a) Thanks [@naldomadeira](https://github.com/naldomadeira)! - refactor(adapters): centralize 400 error messages (G7, parity gap)

  All `BadRequestException` messages emitted by adapters, handlers, and normalizers now come from a single source of truth in `src/contracts/error-messages.ts` (also exposed as `ErrorMessages` namespace from the package root). The same logical error now produces the same byte-for-byte message regardless of which adapter (TypeORM, Drizzle, or Prisma) is wired up.

  User-visible wording changes:
  - Drizzle adapter messages no longer carry the `DrizzleAdapter:` prefix.
  - The Drizzle "ORDER BY a column from 'many' relation" message is now the shorter `Cannot sort by '<path>': sorting through to-many relations is not supported.`, matching the Prisma adapter.
  - `Invalid filter field name:` becomes `Invalid filter field format:` to align with the existing `Invalid <scope> field format:` wording used elsewhere.
  - Prisma's `Include path(s) not allowed` becomes `Include(s) not allowed` to match the handler form.
  - The `Unknown relation '<hop>'` message no longer mentions a specific adapter (e.g. `PrismaSource.relations`); it now says `Declare it in source.relations.`

  Consumers parsing `error.message` should switch to importing the templates from `import { ErrorMessages } from 'nestjs-rest-query'` (or compare against well-known substrings).

### Patch Changes

- [#33](https://github.com/naldomadeira/nestjs-rest-query/pull/33) [`102eb49`](https://github.com/naldomadeira/nestjs-rest-query/commit/102eb491feb1c8d611b53590cdef7ed3c09fe15a) Thanks [@naldomadeira](https://github.com/naldomadeira)! - docs(parity): mark `?sort=<many-rel>.<col>` as an intentional adapter divergence

  TypeORM permits sorting through a `'many'` relation (legacy: returns the first arbitrary row of the join), while Drizzle and Prisma reject with 400. The behavior is now explicitly documented in `MIGRATION.md` under "Intentional adapter divergences", and the parity matrix encodes it via the new `accept` field on each test case so a future regression in any direction surfaces immediately. No code change in this entry — only docs and test infrastructure.

- [#33](https://github.com/naldomadeira/nestjs-rest-query/pull/33) [`102eb49`](https://github.com/naldomadeira/nestjs-rest-query/commit/102eb491feb1c8d611b53590cdef7ed3c09fe15a) Thanks [@naldomadeira](https://github.com/naldomadeira)! - fix(drizzle): escape % and \_ in search terms (G1, parity gap)

  The Drizzle adapter previously interpolated the user's search term into
  the ILIKE pattern without escaping `%` or `_`, so `?search=50%25` would
  match more rows than the literal string `50%`. The TypeORM handler has
  always escaped these characters, and the Prisma adapter is unaffected
  because it uses Prisma's literal `contains` operator. Drizzle now
  matches both: the term is escaped before being wrapped with `%...%`.

- [#33](https://github.com/naldomadeira/nestjs-rest-query/pull/33) [`102eb49`](https://github.com/naldomadeira/nestjs-rest-query/commit/102eb491feb1c8d611b53590cdef7ed3c09fe15a) Thanks [@naldomadeira](https://github.com/naldomadeira)! - fix(prisma): treat filter[\*][in]= and filter[\*][notIn]= (empty) as a no-op (G2, parity gap)

  The Prisma adapter previously rejected empty `in` / `notIn` arrays with
  a 400, while TypeORM and Drizzle silently dropped the predicate. Prisma
  now matches: an empty `in` / `notIn` is a no-op, returning the same
  result set as if the filter had not been provided.

## 2.1.0

### Minor Changes

- [#29](https://github.com/naldomadeira/nestjs-rest-query/pull/29) [`41a7719`](https://github.com/naldomadeira/nestjs-rest-query/commit/41a771903c5ac13a313bbaff177710a5ba92bd8b) Thanks [@naldomadeira](https://github.com/naldomadeira)! - Add `PrismaAdapter` exported from `nestjs-rest-query/prisma`. `@prisma/client` is now an optional peer dependency. The adapter implements the full `RestQueryAdapter` contract — filters, sorts, includes, search, fields (with root-PK auto-injection), pagination, and `customize` — and translates dotted relation paths through `'many'` hops with Prisma's `some` semantics. `select` and `include` are reconciled into a single `select` tree when both are needed at the same level. No changes to existing TypeORM or Drizzle behavior, no public-API changes.

## 2.0.0

### Major Changes

- [#17](https://github.com/naldomadeira/nestjs-rest-query/pull/17) [`fc7866a`](https://github.com/naldomadeira/nestjs-rest-query/commit/fc7866ab13a3c8db6c8ccfb3bf117e08bdbfa5ea) Thanks [@naldomadeira](https://github.com/naldomadeira)! - `DrizzleAdapter` and subpath exports — the library is now ORM-agnostic in practice.

  ### New
  - `DrizzleAdapter` — full Drizzle ORM support via `nestjs-rest-query/drizzle`.
  - Subpath exports — `nestjs-rest-query/typeorm` and `nestjs-rest-query/drizzle` ship as separate entries; bundle size shrinks for single-ORM consumers.
  - `DrizzleSource<TTable, TDb>` — typed source for the Drizzle adapter, with discriminated `relations` (`'one'` vs `'many'`) and required `primaryKey` for `'many'` relations.
  - Two-phase pagination for 1:N relations — returns correct distinct totals and arrays of children per root, matching TypeORM's `getManyAndCount` semantics.

  ### Breaking
  - `typeorm` is now an **optional** peer dependency. Install it explicitly if you use the default `TypeOrmAdapter` and weren't relying on transitive resolution.
  - `drizzle-orm` is also an optional peer dependency. Install only if you adopt `DrizzleAdapter`.

  ### Drizzle adapter contract (only relevant if you adopt the new adapter)
  - Result shape is **table-grouped, one level deep**. `cardinality: 'one'` keys are scalar objects; `cardinality: 'many'` keys are arrays deduplicated by `relation.primaryKey`. Not TypeORM-style deep nesting.
  - ORDER BY a column reached through a `'many'` relation is **not supported** (semantic ambiguity under DISTINCT collapse). Use the `customize` hook to order relation arrays in your application layer.
  - `cardinality: 'many'` requires `primaryKey`. Enforced at TypeScript level (discriminated union) and at runtime (throws synchronously in `createQueryBuilder`).

  ### No code changes required (TypeORM users)

  If you were using TypeORM with the default `forRoot()`, no application code changes. The default adapter is still `TypeOrmAdapter`. The `paginate=false` branch keeps returning `{ data }` exactly as in `1.x`.

  See [`MIGRATION.md`](./MIGRATION.md) for the full 1.x → 2.x guide.

### Minor Changes

- [#15](https://github.com/naldomadeira/nestjs-rest-query/pull/15) [`525e15b`](https://github.com/naldomadeira/nestjs-rest-query/commit/525e15b3989e3e4bec000f3fbe0d8136c3841cd9) Thanks [@naldomadeira](https://github.com/naldomadeira)! - Introduce ORM-agnostic adapter pattern (Phase 1).

  `forRoot()` now accepts an optional `adapter: RestQueryAdapter`. When omitted, the default `TypeOrmAdapter` is used and behavior is identical to `1.0.x` — including the `paginate=false` branch that returns `{ data }` without page/total.

  This release adds:
  - `RestQueryAdapter` interface — the contract any ORM adapter must satisfy.
  - `TypeOrmAdapter` — wraps the existing handlers; lazy-requires `typeorm`.
  - `QueryBuilderConfig.adapter` — optional, defaults to `new TypeOrmAdapter()`.

  No application-level changes are required for existing TypeORM consumers. The `RestQueryAdapter` type and `TypeOrmAdapter` class are exported from the package root for users who want to compose or replace the adapter.

  This is Phase 1 of the ORM-agnostic refactor. A real `DrizzleAdapter` and subpath exports (`nestjs-rest-query/typeorm`, `nestjs-rest-query/drizzle`) ship in `2.0.0` once `1.1.0` has baked. See `plans/orm-agnostic-and-drizzle/`.

### Patch Changes

- [#19](https://github.com/naldomadeira/nestjs-rest-query/pull/19) [`b065bac`](https://github.com/naldomadeira/nestjs-rest-query/commit/b065bac4ebd17a1dedb6d8633d7db44f89f018af) Thanks [@naldomadeira](https://github.com/naldomadeira)! - `DrizzleAdapter` now returns rows in the **flat TypeORM-compatible shape**: root columns at the top level, relations as keys at the same level (object for `cardinality: 'one'`, array for `cardinality: 'many'`).

  Same SQL, same totals, same two-phase pagination — only the response layout changes from the previous table-grouped form (`{ user: {...}, company: {...} }`) to the flat form (`{ id, name, ..., company: {...}, posts: [...] }`).

  `rules.alias` no longer affects the response shape (it remains useful for logging and error messages).

  If a root column has the same name as a relation key, the relation overwrites the column. Avoid at schema design time.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Fixed

## 1.0.0

### Added

- First public open source release as `nestjs-rest-query` on npm.
- `RestQuery*` API rename roadmap (planned for next major).
- TypeORM support (Prisma and Drizzle coming soon).

### Changed

- Package renamed from `@multitechbr/nestjs-dynamic-query-builder` (private package) to `nestjs-rest-query` (public npm).
- License changed from ISC to **MIT**.

### Removed

- Legacy CI configuration (replaced by GitHub Actions).
- Internal `@multitechbr` registry references.

See [MIGRATION.md](./MIGRATION.md) for the upgrade path from the internal package.
