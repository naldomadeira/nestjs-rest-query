/**
 * Source object passed to `QueryBuilderService.execute(source, ...)` /
 * `QueryBuilderService.buildQuery(source, ...)` when the configured
 * adapter is `PrismaAdapter`.
 *
 * `PrismaSource` is intentionally leaner than `DrizzleSource`:
 *
 * - **No `columnMap`**. Prisma resolves field names through the
 *   schema-generated client (`prisma.user.findMany({ where: { name: ... } })`),
 *   so a client-side mapping table is unnecessary. Field-name validation
 *   still flows through the existing `RulesConfig` whitelist.
 * - **`primaryKeyField: string` instead of `AnyColumn`**. Drizzle stores a
 *   per-relation `AnyColumn` because it must dedupe inflated root rows
 *   after SQL joins. Prisma's `findMany` returns root rows directly, so
 *   the adapter only needs the root PK as a string field name.
 *
 * Generic parameter `TPrisma` is loose by design — it represents a
 * `PrismaClient` instance (or a compatible facade) and is not constrained
 * because the adapter only calls `prisma[model].findMany(...)` and
 * `prisma[model].count(...)` at runtime.
 */
export interface PrismaSource<TPrisma = unknown> {
  /** PrismaClient instance or compatible facade. */
  prisma: TPrisma;

  /**
   * Delegate key on the client, e.g. `'user'`, `'company'`, `'post'`.
   * The adapter calls `prisma[model].findMany(...)` and `.count(...)`.
   */
  model: string;

  /**
   * Root primary key field. Defaults to `'id'`.
   * Used for root-PK auto-injection in field projection.
   */
  primaryKeyField?: string;

  /**
   * Relation metadata required for dotted-path validation and for choosing
   * Prisma's relation filter shape (`'one'` => nested object,
   * `'many'` => `some`).
   *
   * If a dotted-path filter/sort/search/include/field references a
   * relation hop not declared here, the adapter throws a 400.
   *
   * Example:
   * ```ts
   * relations: {
   *   company: {
   *     cardinality: 'one',
   *     relations: {
   *       owner: { cardinality: 'one' },
   *     },
   *   },
   *   posts: { cardinality: 'many' },
   * }
   * ```
   */
  relations?: Record<string, PrismaRelation>;
}

export interface PrismaRelation {
  /**
   * Defaults to `'one'`. Use `'many'` for array-valued relations.
   * Drives the `where` shape: `'one'` nests a plain object, `'many'`
   * wraps under `some` so a dotted path matches "any related row".
   */
  cardinality?: 'one' | 'many';

  /**
   * Primary key field of the related model. Defaults to `'id'`.
   * Used for `fields + includes` to inject the relation's PK into the
   * generated `select` tree (so `?fields=id,name&includes=company` can
   * emit `company: { select: { id: true } }` even when the relation's
   * PK is not literally `id`).
   */
  primaryKeyField?: string;

  /**
   * Nested relations for deeper dotted paths.
   * Example: `company.owner.profile`.
   */
  relations?: Record<string, PrismaRelation>;
}
