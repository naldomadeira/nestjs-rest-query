---
'nestjs-rest-query': major
---

`DrizzleAdapter` and subpath exports — the library is now ORM-agnostic in practice.

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
