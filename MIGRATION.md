# Migration Guide

## From `@multitechbr/nestjs-dynamic-query-builder` to `nestjs-rest-query`

This library was previously published as `@multitechbr/nestjs-dynamic-query-builder` on a private registry. It has been renamed and released as the public, MIT-licensed `nestjs-rest-query` on npm.

### Install

```bash
pnpm remove @multitechbr/nestjs-dynamic-query-builder
pnpm add nestjs-rest-query
```

You can also remove the legacy `.npmrc` configuration that was required to access the private registry - it is no longer needed.

### Imports

In the **first 1.0.0 release** the package name changes but the public API identifiers remain the same as in `4.x`. Replace only the import path:

```diff
- import { DynamicQueryBuilderModule } from '@multitechbr/nestjs-dynamic-query-builder';
+ import { DynamicQueryBuilderModule } from 'nestjs-rest-query';
```

### Behavior

Behavior is preserved 1:1. Whitelist semantics, all 15 operators, pagination shape, sort/field/include/search handlers, Swagger integration — all unchanged.

### Public API rename (planned)

A future release will rename the public API surface to align with the new package name:

| Today (1.0.0)                  | Planned                       |
| ------------------------------ | ----------------------------- |
| `DynamicQueryBuilderModule`    | `RestQueryModule`             |
| `QueryBuilderService`          | `RestQueryService`            |
| `@DynamicQuery`                | `@RestQuery`                  |
| `@ApiDynamicQuery`             | `@ApiRestQuery`               |
| `RulesConfig`                  | `RestQueryRules`              |
| `QueryInput`                   | `RestQueryInput`              |
| `QueryResult`                  | `RestQueryResult`             |
| `QueryBuilderConfig`           | `RestQueryConfig`             |
| `DQB_CONFIG_TOKEN`             | `REST_QUERY_CONFIG`           |
| `dqbSwaggerRequestInterceptor` | `restQuerySwaggerInterceptor` |
| `DynamicQueryDto`              | `RestQueryDto`                |

That rename will ship in a major version bump with this guide updated. Track progress in the [migration plan](./plans/migration-to-github-and-npm/).

### License

Changed from ISC (internal) to **MIT** (public).

### Reporting issues during migration

If anything broke after the upgrade, open an issue:
https://github.com/naldomadeira/nestjs-rest-query/issues

## 1.x → 2.x

### Breaking — peer dependencies

- `typeorm` is now an **optional** peer dependency. If you were relying on it being pulled in transitively, install it explicitly: `pnpm add typeorm`.
- `drizzle-orm` is an **optional** peer dependency. Install only if you use the Drizzle adapter.

### Breaking — Drizzle adapter contracts (only relevant if you adopt `DrizzleAdapter`)

The Drizzle adapter has explicit, runtime-enforced constraints. None of these affect TypeORM users.

1. **`relations[*].cardinality: 'many'` requires `primaryKey`.** The TypeScript discriminated union catches it at compile time; the adapter's `createQueryBuilder` re-checks at runtime and throws:

   > DrizzleAdapter: relation "posts" has cardinality 'many' but no primaryKey. 'many' relations require relations["posts"].primaryKey for deduplication. If this is a 1:1 relation, change cardinality to 'one' (or omit it).

2. **ORDER BY a column reached through a `'many'` relation is not supported.** Calling the adapter with `?sorts=posts.createdAt` (where `posts` is `cardinality: 'many'`) throws:

   > Cannot sort by 'posts.createdAt': sorting through to-many relations is not supported.

   This rules out a sort pattern that has no well-defined SQL semantics under the two-phase pagination strategy. Workaround: use the `customize` hook to add ordering of relation arrays in your application layer after the adapter has produced its rows. See ["Intentional adapter divergences"](#intentional-adapter-divergences-parity) below for the cross-adapter view.

3. **Result shape is flat — TypeORM-compatible.** Root columns are at the top level; relations are nested as keys at the same level: object for `cardinality: 'one'` (or `null` if the LEFT JOIN found no match) and array for `cardinality: 'many'` (deduplicated by `relation.primaryKey`, possibly empty). No deep nesting of relations-of-relations — for that, wait for a future `DrizzleRelationalAdapter` based on `db.query.<table>.findMany({ with })`.

   ```json
   {
     "id": "u_1",
     "name": "Ana",
     "email": "ana@acme.com",
     "company": { "id": "c_1", "name": "Acme" },
     "posts": [{ "id": "p_1", "title": "Hello" }]
   }
   ```

   `rules.alias` does not affect the response shape (it remains useful for logging and error messages).

   Caveat: if a root column has the same name as a relation key, the relation overwrites the column. Avoid at schema design time.

### New

- `DrizzleAdapter` available via `nestjs-rest-query/drizzle`.
- Subpath exports — bundle size shrinks for single-ORM consumers.

### No code changes required (TypeORM users)

If you were using TypeORM with the default `forRoot()`, no application code changes. The default adapter is still TypeORM. The `paginate=false` branch keeps returning `{ data }` exactly as before.

## Intentional adapter divergences (parity)

The library aims for behavioral parity across TypeORM, Drizzle, and Prisma. A few spots are documented divergences — same input, different observable outcome by adapter — because the underlying SQL/ORM model makes "the same as TypeORM" either ambiguous or unsafe. The cross-adapter parity matrix in `tests/parity/matrix.spec.ts` encodes each one explicitly so it is impossible to introduce a new silent divergence.

### `?sort=<many-rel>.<column>` — sort through a to-many relation

| Adapter | Behavior                                                                                            | Why                                                                                                                                                                                                                       |
| ------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeORM | **Accepts.** Result is the first arbitrary row of the join under DISTINCT-like collapse.            | Historical: TypeORM's query builder does not consult cardinality at sort time. Preserved for backward compatibility.                                                                                                      |
| Drizzle | **Rejects 400** with `Cannot sort by '<path>': sorting through to-many relations is not supported.` | The two-phase pagination (root IDs first, then data) uses `selectDistinct(id, sortColumn)` — including a column from a `'many'` relation lets the same root id appear multiple times before `LIMIT`, breaking pagination. |
| Prisma  | **Rejects 400** with the same message.                                                              | Prisma's nested `orderBy` has no defined semantics for ordering a parent by a key inside a child collection.                                                                                                              |

**Recommendation.** For deterministic results, sort by a root column or a column on a `'one'` relation. To order the relation array within each row, use the `customize` hook (`execute(..., (qb) => { ... })`) to apply per-relation ordering in the application layer after the adapter has produced its rows. The TypeORM behavior here should be treated as legacy — relying on it produces non-deterministic output across rows.

### Adapters table

The remaining behaviors (filter operators, search, pagination shape, `paginate=false`, customize hook, `isNull` on a `'one'` or `'many'` relation, repeated filters, whitelist rejection, dotted-path filters) are exercised by the parity matrix and produce identical outcomes across all three adapters, including byte-for-byte 400 messages. See `plans/adapters-parity/05-summary-and-open-gaps.md` for the master table and the audit trail.
