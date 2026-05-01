# Changelog

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

- Package renamed from `@multitechbr/nestjs-dynamic-query-builder` (private GitLab) to `nestjs-rest-query` (public npm).
- License changed from ISC to **MIT**.

### Removed

- GitLab CI configuration (replaced by GitHub Actions).
- Internal `@multitechbr` registry references.

See [MIGRATION.md](./MIGRATION.md) for the upgrade path from the internal package.
