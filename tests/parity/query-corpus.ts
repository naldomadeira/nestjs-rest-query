/**
 * Canonical query corpus (G6 Fase A).
 *
 * **TypeORM is the canonical reference.** Every `expected` outcome below
 * mirrors what `TypeOrmAdapter` already does today; Drizzle and Prisma
 * must produce the same observable behavior. Divergences are gaps to
 * fix, not facts to live with — the matrix runner reports any adapter
 * that doesn't agree with `expected` as a failure.
 *
 * The only escape hatch is `skip`, used temporarily for adapters whose
 * fix isn't in the same PR. Skips reference an entry in
 * `plans/completed/adapters-parity/05-summary-and-open-gaps.md`. The end state of
 * the parity work is `skip` being empty everywhere.
 *
 * IDs follow the line numbers of the master table.
 *
 * The corpus is schema-bound to a single canonical model:
 *
 *   user  { id, name, email, age, createdAt }
 *     -- one  --> company  { id, name }
 *     -- many --> posts    { id, title, userId, createdAt }
 *
 * The fixture layer is responsible for materializing this shape into the
 * adapter-specific source (TypeORM Repository mock, DrizzleSource, or
 * PrismaSource).
 */

import type { RulesConfig } from '@contracts/rules-config.interface';

export type AdapterId = 'typeorm' | 'drizzle' | 'prisma';

export type ExpectedOutcome =
  | {
      kind: 'success';
      /** Asserts result.data has exactly this length. */
      dataLength?: number;
      /** Asserts these top-level keys are present on the result envelope. */
      hasFields?: ReadonlyArray<
        'data' | 'page' | 'perPage' | 'total' | 'lastPage'
      >;
      /** Asserts these top-level keys are absent. Used for paginate=false. */
      lacksFields?: ReadonlyArray<'page' | 'perPage' | 'total' | 'lastPage'>;
    }
  | { kind: 'error'; status: 400; message: string };

/**
 * An open gap that means the case can't run for an adapter yet. The gap
 * label (G1, G2, G3, ...) is free-form; convention is to reference an
 * entry in `plans/completed/adapters-parity/05-summary-and-open-gaps.md`. Skips
 * are *temporary* — the long-term goal is zero skips (every adapter
 * agrees on every line of the contract).
 */
export interface Skip {
  gap: string;
  note: string;
}

export interface ParityCase {
  /** Stable id mirroring the master-table line number. */
  id: string;
  /** What the case proves about the contract. */
  description: string;
  /** Master-table line number from `05-summary-and-open-gaps.md`. */
  masterLine: number;
  /** Whitelist passed to the adapter. */
  rules: RulesConfig;
  /** Querystring without leading '?'. The matrix runner parses it. */
  query: string;
  /** Optional: when true, the matrix asserts the customize callback affects both data and count. */
  customize?: 'extra-where';
  /** Optional: also run with paginate=false (default true). */
  paginate?: boolean;
  /** The single canonical outcome — every adapter must agree. */
  expected: ExpectedOutcome;
  /**
   * Per-adapter conscious deviation from the canonical contract. Used only
   * for behaviors documented in `MIGRATION.md` as intentional (e.g. #18
   * sort-through-many: TypeORM permits, others reject). Distinct from
   * `skip`, which is a *temporary* gap waiting on a fix.
   */
  accept?: Partial<Record<AdapterId, ExpectedOutcome>>;
  /** Per-adapter pending gaps. The aim is to keep this map empty. */
  skip?: Partial<Record<AdapterId, Skip>>;
}

// ----------------------------------------------------------------------
// Convenience builders so cases stay short and uniform.
// ----------------------------------------------------------------------

const ok = (): ExpectedOutcome => ({ kind: 'success' });
const err = (message: string): ExpectedOutcome => ({
  kind: 'error',
  status: 400,
  message,
});

// Default whitelist used by ~half the cases. Specific cases override it.
const FULL_RULES: RulesConfig = {
  alias: 'user',
  filters: ['id', 'name', 'email', 'age', 'createdAt', 'company', 'posts'],
  sorts: ['id', 'name', 'age', 'createdAt', 'company.name', 'posts.title'],
  fields: ['id', 'name', 'email', 'age', 'createdAt'],
  includes: ['company', 'posts'],
  search: ['name', 'email', 'company.name'],
};

// ----------------------------------------------------------------------
// Corpus
// ----------------------------------------------------------------------

export const PARITY_CORPUS: ParityCase[] = [
  // --- #2 whitelist rejection ----------------------------------------
  {
    id: 'P-02',
    description: 'rejects filter on a field outside the whitelist with 400',
    masterLine: 2,
    rules: { ...FULL_RULES, filters: ['name'] },
    query: 'filter[secret][eq]=x',
    expected: err('Filter field(s) not allowed: secret. Allowed fields: name'),
  },

  // --- #3 dotted path on `'one'` relation -----------------------------
  {
    id: 'P-03',
    description: 'accepts dotted-path filter on a one-relation',
    masterLine: 3,
    rules: FULL_RULES,
    query: 'filter[company.name][eq]=Acme',
    expected: ok(),
  },

  // --- #5 PK injection when ?fields=... ------------------------------
  {
    id: 'P-05',
    description: 'auto-injects root primary key when ?fields= is set',
    masterLine: 5,
    rules: FULL_RULES,
    query: 'fields=name,email',
    expected: ok(),
  },

  // --- #6 PK of relation when fields + includes ----------------------
  {
    id: 'P-06',
    description: 'auto-injects relation PK when fields+includes are combined',
    masterLine: 6,
    rules: FULL_RULES,
    query: 'fields=name&includes=company',
    expected: ok(),
  },

  // --- #7 search is OR of ILIKE -------------------------------------
  {
    id: 'P-07',
    description: 'applies search as OR of case-insensitive LIKE across fields',
    masterLine: 7,
    rules: FULL_RULES,
    query: 'search=alice',
    expected: ok(),
  },

  // --- #8 search literal `%` / `_` -----------------------------------
  {
    id: 'P-08',
    description:
      'treats %% and _ in the search term as literal characters, not wildcards',
    masterLine: 8,
    rules: FULL_RULES,
    query: 'search=50%25',
    expected: ok(),
  },

  // --- #9 in: [] no-op ----------------------------------------------
  {
    id: 'P-09',
    description: 'treats filter[id][in]= (empty) as a no-op, not 400',
    masterLine: 9,
    rules: FULL_RULES,
    query: 'filter[id][in]=',
    expected: ok(),
  },

  // --- #10 isNull boolean-coerced -----------------------------------
  {
    id: 'P-10',
    description: 'accepts filter[email][isNull]=true and coerces to boolean',
    masterLine: 10,
    rules: FULL_RULES,
    query: 'filter[email][isNull]=true',
    expected: ok(),
  },

  // --- #12/13 pagination 1:N ----------------------------------------
  {
    id: 'P-12',
    description: 'paginates with a 1:N include and returns the full envelope',
    masterLine: 12,
    rules: FULL_RULES,
    query: 'includes=posts&page=1&perPage=10',
    expected: {
      kind: 'success',
      hasFields: ['data', 'page', 'perPage', 'total', 'lastPage'],
    },
  },

  // --- #14 paginate=false -------------------------------------------
  {
    id: 'P-14',
    description:
      'returns { data } without page/perPage/total/lastPage when paginate=false',
    masterLine: 14,
    rules: FULL_RULES,
    query: 'filter[name][eq]=alice',
    paginate: false,
    expected: {
      kind: 'success',
      hasFields: ['data'],
      lacksFields: ['page', 'perPage', 'total', 'lastPage'],
    },
  },

  // --- #15 result shape ---------------------------------------------
  {
    id: 'P-15',
    description: 'returns the paginated envelope with both relations included',
    masterLine: 15,
    rules: FULL_RULES,
    query: 'includes=company,posts',
    expected: {
      kind: 'success',
      hasFields: ['data', 'page', 'perPage', 'total', 'lastPage'],
    },
  },

  // --- #16 customize affects data AND count -------------------------
  // The matrix runner injects a `customize` callback that pushes a
  // WHERE clause; the case asserts both data and count reflect it.
  {
    id: 'P-16',
    description: 'customize hook mutation propagates to both data and count',
    masterLine: 16,
    rules: FULL_RULES,
    query: 'page=1&perPage=10',
    customize: 'extra-where',
    expected: ok(),
  },

  // --- #17 sort by `'one'` relation column --------------------------
  {
    id: 'P-17',
    description: 'accepts sort by a column on a one-relation',
    masterLine: 17,
    rules: FULL_RULES,
    query: 'sort=company.name',
    expected: ok(),
  },

  // --- #18 sort by `'many'` relation column -------------------------
  // **Intentional adapter divergence**, documented in `MIGRATION.md`
  // under "Intentional adapter divergences". TypeORM permits the sort
  // (legacy: returns the first arbitrary row of the join), Drizzle and
  // Prisma reject 400 because their query model does not have a
  // well-defined semantics for ordering a parent by a column on a
  // to-many child.
  {
    id: 'P-18',
    description:
      'sort through a many-relation: TypeORM accepts (legacy), Drizzle/Prisma reject 400',
    masterLine: 18,
    rules: FULL_RULES,
    query: 'sort=posts.title',
    expected: err(
      "Cannot sort by 'posts.title': sorting through to-many relations is not supported."
    ),
    accept: {
      typeorm: { kind: 'success' },
    },
  },

  // --- #19 isNull on `'one'` relation -------------------------------
  // All three adapters resolve filter[<one-rel>][isNull]. TypeORM via
  // metadata, Prisma via `walkPath`, Drizzle via the explicit
  // `nullProbeColumn` declared on the relation (LEFT JOIN + IS NULL).
  {
    id: 'P-19',
    description: 'accepts filter[company][isNull]=true on a one-relation',
    masterLine: 19,
    rules: FULL_RULES,
    query: 'filter[company][isNull]=true',
    expected: ok(),
  },

  // --- #20 isNull on `'many'` relation (G3 → Caminho B) -------------
  // All three adapters accept and produce equivalent results:
  // - TypeORM: LEFT JOIN ... WHERE rel.id IS NULL (legacy gambiarra)
  // - Drizzle: LEFT JOIN ... WHERE primaryKey IS NULL
  // - Prisma:  where: { posts: { none: {} } }  (none/some)
  {
    id: 'P-20-isnull-true',
    description:
      'filter[posts][isNull]=true returns roots with no related posts',
    masterLine: 20,
    rules: FULL_RULES,
    query: 'filter[posts][isNull]=true',
    expected: ok(),
  },
  {
    id: 'P-20-isnull-false',
    description:
      'filter[posts][isNull]=false returns roots with at least one related post',
    masterLine: 20,
    rules: FULL_RULES,
    query: 'filter[posts][isNull]=false',
    expected: ok(),
  },

  // --- #22 repeated filters AND -------------------------------------
  {
    id: 'P-22',
    description:
      'two filters on the same field stack with AND, never structurally merge',
    masterLine: 22,
    rules: FULL_RULES,
    query: 'filter[age][gte]=18&filter[age][lt]=65',
    expected: ok(),
  },

  // --- Unsafe field path (cross-cutting whitelist guard) ------------
  {
    id: 'P-WL-FILTER',
    description:
      'rejects unsafe filter field path (regex guard) — same message all adapters',
    masterLine: 2,
    rules: FULL_RULES,
    query: 'filter[name; DROP TABLE][eq]=x',
    expected: err(
      'Invalid filter field format: "name; DROP TABLE". Only alphanumeric, underscore, and dots are allowed.'
    ),
  },

  {
    id: 'P-WL-SORT',
    description: 'rejects sort field outside the whitelist',
    masterLine: 2,
    rules: { ...FULL_RULES, sorts: ['id'] },
    query: 'sort=ssn',
    expected: err('Sort field(s) not allowed: ssn. Allowed sorts: id'),
  },

  {
    id: 'P-WL-INCLUDES',
    description: 'rejects include outside the whitelist',
    masterLine: 2,
    rules: { ...FULL_RULES, includes: ['company'] },
    query: 'includes=secret',
    expected: err('Include(s) not allowed: secret. Allowed includes: company'),
  },

  // --- Operator validation (cross-cutting) --------------------------
  {
    id: 'P-OP-UNKNOWN',
    description:
      'rejects unsupported operator with the same message across adapters',
    masterLine: 27,
    rules: FULL_RULES,
    query: 'filter[name][nope]=x',
    expected: err(
      'Unsupported operator "nope" for field "name". Supported: eq, ne, like, ilike, notLike, notIlike, gt, gte, lt, lte, in, notIn, between, isNull'
    ),
  },

  // --- Pagination boundaries ---------------------------------------
  {
    id: 'P-PAGE-MIN',
    description: 'page < 1 returns 400 with the same message in every adapter',
    masterLine: 27,
    rules: FULL_RULES,
    query: 'page=0',
    expected: err('"page" must be >= 1'),
  },
];
