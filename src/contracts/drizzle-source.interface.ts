import type { AnyColumn, SQL, Table } from 'drizzle-orm';

/**
 * Description of a single relation join used by `DrizzleAdapter`.
 *
 * The adapter requires consumers to declare each joinable relation
 * explicitly because Drizzle's query API does not auto-discover joins
 * from foreign keys (unlike TypeORM's metadata).
 *
 * Use the `'one'` shape for 1:1 / N:1 relations (single related row),
 * and the `'many'` shape for 1:N / N:N (multiple related rows). The
 * `cardinality` discriminator drives:
 *
 * - The result shape — `'one'` produces a scalar key, `'many'` produces
 *   an array key in `data` rows.
 * - Pagination strategy — any `'many'` join activates two-phase
 *   pagination so `total` and `data.length` reflect distinct root rows
 *   instead of the cartesian-inflated joined row count.
 */
export type DrizzleRelation = DrizzleRelationOne | DrizzleRelationMany;

export interface DrizzleRelationOne {
  /** Drizzle table object the join targets (e.g. `companies`). */
  table: Table;
  /** Drizzle SQL ON expression (e.g. `eq(users.companyId, companies.id)`). */
  on: SQL;
  /**
   * Optional explicit cardinality. Defaults to `'one'`.
   * `primaryKey` is ignored for `'one'` relations.
   */
  cardinality?: 'one';
  /** Ignored for `'one'`. Allowed for forward compatibility. */
  primaryKey?: AnyColumn;
  /**
   * Column on the related table used to detect "relation is null" in
   * `filter[<rel>][isNull]`. Typically the relation's primary key — e.g.
   * `companies.id` for the `company` relation. The adapter emits a
   * `LEFT JOIN` plus `WHERE <nullProbeColumn> IS [NOT] NULL`.
   *
   * Required for `isNull` filters on a `'one'` relation; otherwise
   * optional. If a consumer issues `filter[<rel>][isNull]=...` and this
   * column is not declared, the adapter throws a 400 with a clear
   * message pointing to this field.
   */
  nullProbeColumn?: AnyColumn;
}

export interface DrizzleRelationMany {
  /** Drizzle table object the join targets (e.g. `posts`). */
  table: Table;
  /** Drizzle SQL ON expression (e.g. `eq(posts.userId, users.id)`). */
  on: SQL;
  /** Required discriminator for to-many relations. */
  cardinality: 'many';
  /**
   * Primary key column of the relation table (e.g. `posts.id`).
   *
   * REQUIRED for `'many'` relations — used to deduplicate rows during
   * client-side aggregation. The adapter throws synchronously at
   * `createQueryBuilder` if absent.
   */
  primaryKey: AnyColumn;
}

/**
 * Source object passed to `QueryBuilderService.execute(source, ...)` /
 * `QueryBuilderService.buildQuery(source, ...)` when the configured
 * adapter is `DrizzleAdapter`.
 *
 * Generic parameters are loose by design: `TTable` is the Drizzle
 * `pgTable` / `mysqlTable` / `sqliteTable` literal you defined, and
 * `TDb` is the database client returned by `drizzle(...)`.
 */
export interface DrizzleSource<TTable extends Table = Table, TDb = unknown> {
  /** The Drizzle database client (return value of `drizzle(...)`). */
  db: TDb;
  /** Root table — every query selects FROM this. */
  table: TTable;
  /**
   * Primary key column of the root table (e.g. `users.id`).
   * Used for `countDistinct(...)` over joined queries and for the
   * automatic root-PK injection in `applySelect`.
   */
  primaryKey: AnyColumn;
  /**
   * Relation map keyed by dot-notation joinPath. Required for any
   * filter/sort/search/include that references a dotted field.
   *
   * Example:
   * ```ts
   * relations: {
   *   company:         { table: companies, on: eq(users.companyId, companies.id) },
   *   'company.owner': { table: users,     on: eq(companies.ownerId, users.id)   },
   *   posts:           { table: posts,     on: eq(posts.userId, users.id), cardinality: 'many', primaryKey: posts.id },
   * }
   * ```
   */
  relations?: Record<string, DrizzleRelation>;
  /**
   * Optional explicit column map for fields that aren't directly on
   * `table` and aren't trivially named on a joined relation table.
   *
   * Looked up by the dot-notation field path BEFORE walking
   * `relations`. Useful when a joined column has a different runtime
   * name than the dotted path suggests.
   *
   * Example:
   * ```ts
   * columnMap: {
   *   'company.name': companies.name,
   *   'company.owner.email': users.email,
   * }
   * ```
   */
  columnMap?: Record<string, AnyColumn>;
}
