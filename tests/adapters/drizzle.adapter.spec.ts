/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException } from '@nestjs/common';
import { PgDialect, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import {
  DrizzleAdapter,
  type DrizzleQB,
} from '@src/infra/adapters/drizzle.adapter';
import type { DrizzleSource } from '@src/contracts/drizzle-source.interface';

// ----------------------------------------------------------------------
// Fixtures: minimal Drizzle-shaped table objects
// ----------------------------------------------------------------------
//
// The adapter only consults `source.table[columnName]` for resolution
// and `getTableColumns(table)` for full-row select shape. We mock both
// without pulling a real Drizzle table.

function fakeColumn(tableName: string, columnName: string) {
  return {
    name: columnName,
    table: { _: { name: tableName } },
    // marker so we can identify columns deterministically in expectations
    __fake: `${tableName}.${columnName}`,
  } as any;
}

function fakeTable(name: string, columns: Record<string, any>) {
  const table: any = {
    _: { name },
    [Symbol.for('drizzle:Columns')]: columns,
  };
  for (const [k, v] of Object.entries(columns)) table[k] = v;
  return table;
}

// Mock getTableColumns — Drizzle's helper. We rely on the columns we
// stamped on the table object via Symbol.
jest.mock('drizzle-orm', () => {
  const actual = jest.requireActual('drizzle-orm');
  return {
    ...actual,
    getTableColumns: (t: any) => t[Symbol.for('drizzle:Columns')] ?? {},
  };
});

// ----------------------------------------------------------------------
// Schema-like fixtures used across tests
// ----------------------------------------------------------------------

const usersCols = {
  id: fakeColumn('users', 'id'),
  email: fakeColumn('users', 'email'),
  name: fakeColumn('users', 'name'),
  companyId: fakeColumn('users', 'company_id'),
  createdAt: fakeColumn('users', 'created_at'),
};
const users = fakeTable('users', usersCols);

const companiesCols = {
  id: fakeColumn('companies', 'id'),
  name: fakeColumn('companies', 'name'),
};
const companies = fakeTable('companies', companiesCols);

const postsCols = {
  id: fakeColumn('posts', 'id'),
  title: fakeColumn('posts', 'title'),
  userId: fakeColumn('posts', 'user_id'),
  createdAt: fakeColumn('posts', 'created_at'),
};
const posts = fakeTable('posts', postsCols);

const temporalUsers = pgTable('temporal_users', {
  id: uuid('id').primaryKey(),
  createdAt: timestamp('created_at').notNull(),
});

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

/**
 * Build a stub `db` with `select`/`selectDistinct` returning chainable
 * accumulators. Each call records what it would do; tests can then
 * inspect the spy via `db.__calls`.
 */
function makeStubDb(): {
  db: any;
  __calls: any[];
  __setRows: (rows: any[]) => void;
  __setCount: (n: number) => void;
  __setIdRows: (rows: any[]) => void;
} {
  const calls: any[] = [];
  let dataRows: any[] = [];
  let countValue = 0;
  let idRows: any[] = [];

  function makeChain(kind: 'select' | 'selectDistinct' | 'count', shape: any) {
    const builder: any = {
      __kind: kind,
      __shape: shape,
      __from: undefined,
      __joins: [] as any[],
      __where: undefined as any,
      __orderBy: [] as any[],
      __limit: undefined as number | undefined,
      __offset: undefined as number | undefined,
    };
    builder.from = (table: any) => {
      builder.__from = table;
      return builder;
    };
    builder.$dynamic = () => builder;
    builder.leftJoin = (table: any, on: any) => {
      builder.__joins.push({ table, on });
      return builder;
    };
    builder.where = (clause: any) => {
      builder.__where = clause;
      return builder;
    };
    builder.orderBy = (clause: any) => {
      builder.__orderBy.push(clause);
      return builder;
    };
    builder.limit = (n: number) => {
      builder.__limit = n;
      return builder;
    };
    builder.offset = (n: number) => {
      builder.__offset = n;
      return builder;
    };
    // Make the builder thenable so `await q` resolves.
    builder.then = (resolve: any) => {
      calls.push(builder);
      if (kind === 'count') {
        return resolve([{ value: countValue }]);
      }
      if (kind === 'selectDistinct') return resolve(idRows);
      return resolve(dataRows);
    };
    return builder;
  }

  const db = {
    select: (shape: any) => {
      // count() / countDistinct() shape is `{ value: ... }`.
      const isCountShape =
        shape &&
        typeof shape === 'object' &&
        Object.keys(shape).length === 1 &&
        'value' in shape;
      return makeChain(isCountShape ? 'count' : 'select', shape);
    },
    selectDistinct: (shape: any) => makeChain('selectDistinct', shape),
  };

  return {
    db,
    __calls: calls,
    __setRows: (r) => {
      dataRows = r;
    },
    __setCount: (n) => {
      countValue = n;
    },
    __setIdRows: (r) => {
      idRows = r;
    },
  };
}

function baseSource(
  db: any,
  overrides: Partial<DrizzleSource<any, any>> = {}
): DrizzleSource<any, any> {
  return {
    db,
    table: users,
    primaryKey: usersCols.id,
    ...overrides,
  };
}

// ======================================================================
// Tests
// ======================================================================

describe('DrizzleAdapter', () => {
  describe('construction validation', () => {
    it('throws when relation has cardinality "many" but no primaryKey', () => {
      const adapter = new DrizzleAdapter();
      const stub = makeStubDb();
      expect(() =>
        adapter.createQueryBuilder(
          baseSource(stub.db, {
            relations: {
              // @ts-expect-error — testing the runtime guard
              posts: { table: posts, on: {} as any, cardinality: 'many' },
            },
          }),
          'user'
        )
      ).toThrow(/cardinality 'many' but no primaryKey/);
    });

    it('does not throw when "many" relation provides primaryKey', () => {
      const adapter = new DrizzleAdapter();
      const stub = makeStubDb();
      expect(() =>
        adapter.createQueryBuilder(
          baseSource(stub.db, {
            relations: {
              posts: {
                table: posts,
                on: {} as any,
                cardinality: 'many',
                primaryKey: postsCols.id,
              },
            },
          }),
          'user'
        )
      ).not.toThrow();
    });

    it('does not throw when "one" relation lacks primaryKey', () => {
      const adapter = new DrizzleAdapter();
      const stub = makeStubDb();
      expect(() =>
        adapter.createQueryBuilder(
          baseSource(stub.db, {
            relations: {
              company: { table: companies, on: {} as any },
            },
          }),
          'user'
        )
      ).not.toThrow();
    });
  });

  describe('applyFilters', () => {
    it('accumulates a WHERE clause for a root-column filter', () => {
      const adapter = new DrizzleAdapter();
      const stub = makeStubDb();
      const qb = adapter.createQueryBuilder(baseSource(stub.db), 'user');
      adapter.applyFilters(
        qb,
        { filter: { email: { eq: 'ana@acme.com' } } } as any,
        'user',
        ['email']
      );
      expect(qb.whereClauses.length).toBe(1);
      // No joins for root-only filter.
      expect(qb.whereJoins.size).toBe(0);
      expect(qb.presentationJoins.size).toBe(0);
    });

    it('auto-adds a whereJoin when filtering on a dotted relation path', () => {
      const adapter = new DrizzleAdapter();
      const stub = makeStubDb();
      const qb = adapter.createQueryBuilder(
        baseSource(stub.db, {
          relations: { company: { table: companies, on: {} as any } },
        }),
        'user'
      );
      adapter.applyFilters(
        qb,
        { filter: { 'company.name': { eq: 'Acme' } } } as any,
        'user',
        ['company']
      );
      expect(qb.whereJoins.has('company')).toBe(true);
      expect(qb.presentationJoins.has('company')).toBe(false);
    });

    it('rejects unknown filter fields', () => {
      const adapter = new DrizzleAdapter();
      const stub = makeStubDb();
      const qb = adapter.createQueryBuilder(baseSource(stub.db), 'user');
      expect(() =>
        adapter.applyFilters(
          qb,
          { filter: { password: { eq: 'x' } } } as any,
          'user',
          ['email']
        )
      ).toThrow(/not allowed/);
    });

    it('skips empty IN arrays without producing a WHERE clause', () => {
      const adapter = new DrizzleAdapter();
      const stub = makeStubDb();
      const qb = adapter.createQueryBuilder(baseSource(stub.db), 'user');
      adapter.applyFilters(
        qb,
        { filter: { email: { in: '' } } } as any,
        'user',
        ['email']
      );
      expect(qb.whereClauses.length).toBe(0);
    });

    it('enforces the operatorsConfig.allowed list', () => {
      const adapter = new DrizzleAdapter();
      const stub = makeStubDb();
      const qb = adapter.createQueryBuilder(baseSource(stub.db), 'user');
      expect(() =>
        adapter.applyFilters(
          qb,
          { filter: { email: { ilike: 'a' } } } as any,
          'user',
          ['email'],
          { allowed: ['eq'] }
        )
      ).toThrow(/not allowed/);
    });

    it('coerces timestamp filters to Date-compatible values before SQL compilation', () => {
      const adapter = new DrizzleAdapter();
      const stub = makeStubDb();
      const qb = adapter.createQueryBuilder(
        {
          db: stub.db,
          table: temporalUsers,
          primaryKey: temporalUsers.id,
        },
        'user'
      );

      adapter.applyFilters(
        qb,
        { filter: { createdAt: { gte: '2024-01-01' } } } as any,
        'user',
        ['createdAt']
      );

      const dialect = new PgDialect();
      expect(() => dialect.sqlToQuery(qb.whereClauses[0]!)).not.toThrow();
    });
  });

  describe('applySorts', () => {
    it('accumulates ORDER BY for a root column with desc prefix', () => {
      const adapter = new DrizzleAdapter();
      const stub = makeStubDb();
      const qb = adapter.createQueryBuilder(baseSource(stub.db), 'user');
      adapter.applySorts(qb, { sort: '-name,email' } as any, 'user', [
        'name',
        'email',
      ]);
      expect(qb.orderByClauses.length).toBe(2);
    });

    it('rejects sort through a "many" relation column', () => {
      const adapter = new DrizzleAdapter();
      const stub = makeStubDb();
      const qb = adapter.createQueryBuilder(
        baseSource(stub.db, {
          relations: {
            posts: {
              table: posts,
              on: {} as any,
              cardinality: 'many',
              primaryKey: postsCols.id,
            },
          },
        }),
        'user'
      );
      expect(() =>
        adapter.applySorts(qb, { sort: '-posts.title' } as any, 'user', [
          'posts',
        ])
      ).toThrow(/sorting through to-many relations is not supported/);
    });

    it('accepts sort through a "one" relation column and adds a presentation join', () => {
      const adapter = new DrizzleAdapter();
      const stub = makeStubDb();
      const qb = adapter.createQueryBuilder(
        baseSource(stub.db, {
          relations: { company: { table: companies, on: {} as any } },
        }),
        'user'
      );
      adapter.applySorts(qb, { sort: '-company.name' } as any, 'user', [
        'company',
      ]);
      expect(qb.orderByClauses.length).toBe(1);
      expect(qb.presentationJoins.has('company')).toBe(true);
      expect(qb.whereJoins.has('company')).toBe(false);
    });
  });

  describe('applyIncludes', () => {
    it('adds presentation joins for whitelisted includes', () => {
      const adapter = new DrizzleAdapter();
      const stub = makeStubDb();
      const qb = adapter.createQueryBuilder(
        baseSource(stub.db, {
          relations: {
            company: { table: companies, on: {} as any },
            posts: {
              table: posts,
              on: {} as any,
              cardinality: 'many',
              primaryKey: postsCols.id,
            },
          },
        }),
        'user'
      );
      adapter.applyIncludes(qb, { includes: 'company,posts' } as any, 'user', [
        'company',
        'posts',
      ]);
      expect(qb.presentationJoins.has('company')).toBe(true);
      expect(qb.presentationJoins.has('posts')).toBe(true);
    });

    it('rejects unknown include paths', () => {
      const adapter = new DrizzleAdapter();
      const stub = makeStubDb();
      const qb = adapter.createQueryBuilder(baseSource(stub.db), 'user');
      expect(() =>
        adapter.applyIncludes(qb, { includes: 'company' } as any, 'user', [])
      ).toThrow(/not allowed/);
    });
  });

  describe('applySearch', () => {
    it('adds OR clauses across the search columns and promotes joins to where', () => {
      const adapter = new DrizzleAdapter();
      const stub = makeStubDb();
      const qb = adapter.createQueryBuilder(
        baseSource(stub.db, {
          relations: { company: { table: companies, on: {} as any } },
        }),
        'user'
      );
      adapter.applySearch(qb, { search: 'ana' } as any, 'user', [
        'name',
        'company.name',
      ]);
      expect(qb.whereClauses.length).toBe(1);
      expect(qb.whereJoins.has('company')).toBe(true);
    });

    it('is a no-op when the search term is empty', () => {
      const adapter = new DrizzleAdapter();
      const stub = makeStubDb();
      const qb = adapter.createQueryBuilder(baseSource(stub.db), 'user');
      adapter.applySearch(qb, { search: '   ' } as any, 'user', ['name']);
      expect(qb.whereClauses.length).toBe(0);
    });
  });

  describe('applyFields', () => {
    it('auto-injects the root primary key when not requested', () => {
      const adapter = new DrizzleAdapter();
      const stub = makeStubDb();
      const qb = adapter.createQueryBuilder(baseSource(stub.db), 'user');
      adapter.applyFields(qb, { fields: 'name,email' } as any, 'user', [
        'name',
        'email',
      ]);
      expect(qb.selectFields).toBeDefined();
      expect(qb.selectFields!.rootColumns[0]).toBe(usersCols.id);
      expect(qb.selectFields!.rootColumns).toContain(usersCols.name);
      expect(qb.selectFields!.rootColumns).toContain(usersCols.email);
    });

    it('groups dotted-path fields into the relation bucket', () => {
      const adapter = new DrizzleAdapter();
      const stub = makeStubDb();
      const qb = adapter.createQueryBuilder(
        baseSource(stub.db, {
          relations: { company: { table: companies, on: {} as any } },
        }),
        'user'
      );
      adapter.applyFields(qb, { fields: 'name,company.name' } as any, 'user', [
        'name',
        'company',
      ]);
      expect(qb.selectFields!.relationColumns.get('company')).toEqual([
        companiesCols.name,
      ]);
      // Field-driven join is presentation, not where.
      expect(qb.presentationJoins.has('company')).toBe(true);
    });
  });

  describe('count strategy', () => {
    it('uses count() (not distinct) when there are no whereJoins', async () => {
      const adapter = new DrizzleAdapter();
      const stub = makeStubDb();
      stub.__setCount(7);
      const qb = adapter.createQueryBuilder(baseSource(stub.db), 'user');
      adapter.applyFilters(
        qb,
        { filter: { email: { eq: 'ana' } } } as any,
        'user',
        ['email']
      );
      const result = await adapter.applyPagination(qb, {} as any);
      expect(result.total).toBe(7);
      const countCall = stub.__calls.find((c) => c.__kind === 'count');
      expect(countCall.__joins.length).toBe(0);
    });

    it('uses countDistinct(rootPK) and includes whereJoins when filter touches a relation', async () => {
      const adapter = new DrizzleAdapter();
      const stub = makeStubDb();
      stub.__setCount(3);
      const qb = adapter.createQueryBuilder(
        baseSource(stub.db, {
          relations: { company: { table: companies, on: {} as any } },
        }),
        'user'
      );
      adapter.applyFilters(
        qb,
        { filter: { 'company.name': { eq: 'Acme' } } } as any,
        'user',
        ['company']
      );
      await adapter.applyPagination(qb, {} as any);
      const countCall = stub.__calls.find((c) => c.__kind === 'count');
      expect(countCall.__joins.length).toBe(1);
      // countDistinct shape still contains a single { value: <SQL> } entry.
      expect(Object.keys(countCall.__shape)).toEqual(['value']);
    });

    it('count query does NOT include presentation-only joins', async () => {
      const adapter = new DrizzleAdapter();
      const stub = makeStubDb();
      stub.__setCount(10);
      const qb = adapter.createQueryBuilder(
        baseSource(stub.db, {
          relations: { company: { table: companies, on: {} as any } },
        }),
        'user'
      );
      adapter.applySorts(qb, { sort: '-company.name' } as any, 'user', [
        'company',
      ]);
      await adapter.applyPagination(qb, {} as any);
      const countCall = stub.__calls.find((c) => c.__kind === 'count');
      expect(countCall.__joins.length).toBe(0);
    });
  });

  describe('pagination — single-pass (no "many" joins)', () => {
    it('applies limit + offset, runs count in parallel', async () => {
      const adapter = new DrizzleAdapter();
      const stub = makeStubDb();
      stub.__setRows([
        { user: { id: 'u1', name: 'Ana' } },
        { user: { id: 'u2', name: 'Bia' } },
      ]);
      stub.__setCount(2);
      const qb = adapter.createQueryBuilder(baseSource(stub.db), 'user');
      const result = await adapter.applyPagination(qb, {
        page: 1,
        perPage: 10,
      } as any);
      expect(result.data).toHaveLength(2);
      expect(result.page).toBe(1);
      expect(result.perPage).toBe(10);
      expect(result.total).toBe(2);

      const dataCall = stub.__calls.find((c) => c.__kind === 'select');
      expect(dataCall.__limit).toBe(10);
      expect(dataCall.__offset).toBe(0);
    });
  });

  describe('pagination — two-phase (with "many" joins)', () => {
    it('runs phase 1 (DISTINCT root ids) + phase 2 (WHERE IN) + count in parallel', async () => {
      const adapter = new DrizzleAdapter();
      const stub = makeStubDb();
      stub.__setIdRows([{ id: 'u1' }, { id: 'u2' }]);
      stub.__setRows([
        { user: { id: 'u1', name: 'Ana' }, posts: { id: 'p1', title: 'A' } },
        { user: { id: 'u1', name: 'Ana' }, posts: { id: 'p2', title: 'B' } },
        { user: { id: 'u2', name: 'Bia' }, posts: null },
      ]);
      stub.__setCount(2);

      const qb = adapter.createQueryBuilder(
        baseSource(stub.db, {
          relations: {
            posts: {
              table: posts,
              on: {} as any,
              cardinality: 'many',
              primaryKey: postsCols.id,
            },
          },
        }),
        'user'
      );
      adapter.applyIncludes(qb, { includes: 'posts' } as any, 'user', [
        'posts',
      ]);

      const result = await adapter.applyPagination(qb, {
        page: 1,
        perPage: 5,
      } as any);

      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(2);
      expect((result.data[0] as any).posts).toHaveLength(2);
      expect((result.data[1] as any).posts).toEqual([]);

      const distinctCall = stub.__calls.find(
        (c) => c.__kind === 'selectDistinct'
      );
      expect(distinctCall.__limit).toBe(5);
      expect(distinctCall.__offset).toBe(0);

      const dataCall = stub.__calls.find((c) => c.__kind === 'select');
      // Data query has WHERE IN (rootIds) — no limit/offset of its own.
      expect(dataCall.__limit).toBeUndefined();
      expect(dataCall.__offset).toBeUndefined();
    });

    it('returns empty data when phase 1 finds 0 matching roots', async () => {
      const adapter = new DrizzleAdapter();
      const stub = makeStubDb();
      stub.__setIdRows([]);
      stub.__setCount(0);

      const qb = adapter.createQueryBuilder(
        baseSource(stub.db, {
          relations: {
            posts: {
              table: posts,
              on: {} as any,
              cardinality: 'many',
              primaryKey: postsCols.id,
            },
          },
        }),
        'user'
      );
      adapter.applyIncludes(qb, { includes: 'posts' } as any, 'user', [
        'posts',
      ]);

      const result = await adapter.applyPagination(qb, {} as any);
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      // Should NOT issue a phase-2 select.
      expect(
        stub.__calls.filter((c) => c.__kind === 'select' && c.__shape).length
      ).toBe(0);
    });

    it('projects ORDER BY columns in phase 1 DISTINCT query when sorting paginated roots', async () => {
      const adapter = new DrizzleAdapter();
      const stub = makeStubDb();
      stub.__setIdRows([{ id: 'u1' }, { id: 'u2' }]);
      stub.__setRows([
        {
          user: { id: 'u1', name: 'Ana', created_at: '2024-01-02' },
          posts: { id: 'p1', title: 'A' },
        },
        {
          user: { id: 'u2', name: 'Bia', created_at: '2024-01-01' },
          posts: null,
        },
      ]);
      stub.__setCount(2);

      const qb = adapter.createQueryBuilder(
        baseSource(stub.db, {
          relations: {
            posts: {
              table: posts,
              on: {} as any,
              cardinality: 'many',
              primaryKey: postsCols.id,
            },
          },
        }),
        'user'
      );

      adapter.applyIncludes(qb, { includes: 'posts' } as any, 'user', [
        'posts',
      ]);
      adapter.applySorts(qb, { sort: '-createdAt' } as any, 'user', [
        'createdAt',
      ]);

      await adapter.applyPagination(qb, {
        page: 1,
        perPage: 5,
      } as any);

      const distinctCall = stub.__calls.find(
        (c) => c.__kind === 'selectDistinct'
      );
      expect(Object.keys(distinctCall.__shape)).toEqual(
        expect.arrayContaining(['id', '__sort_0'])
      );
    });
  });

  describe('aggregate', () => {
    it('groups rows by root PK, dedups "many" by relation PK', async () => {
      const adapter = new DrizzleAdapter();
      const stub = makeStubDb();
      // Same post p1 appears twice in joined rows; should dedup.
      stub.__setIdRows([{ id: 'u1' }]);
      stub.__setRows([
        { user: { id: 'u1' }, posts: { id: 'p1', title: 'A' } },
        { user: { id: 'u1' }, posts: { id: 'p1', title: 'A' } },
        { user: { id: 'u1' }, posts: { id: 'p2', title: 'B' } },
      ]);
      stub.__setCount(1);

      const qb = adapter.createQueryBuilder(
        baseSource(stub.db, {
          relations: {
            posts: {
              table: posts,
              on: {} as any,
              cardinality: 'many',
              primaryKey: postsCols.id,
            },
          },
        }),
        'user'
      );
      adapter.applyIncludes(qb, { includes: 'posts' } as any, 'user', [
        'posts',
      ]);
      const result = await adapter.applyPagination(qb, {} as any);
      expect((result.data[0] as any).posts).toHaveLength(2);
    });

    it('takes first non-null occurrence for "one" relations', async () => {
      const adapter = new DrizzleAdapter();
      const stub = makeStubDb();
      stub.__setRows([
        { user: { id: 'u1' }, company: { id: 'c1', name: 'Acme' } },
      ]);
      stub.__setCount(1);

      const qb = adapter.createQueryBuilder(
        baseSource(stub.db, {
          relations: { company: { table: companies, on: {} as any } },
        }),
        'user'
      );
      adapter.applyIncludes(qb, { includes: 'company' } as any, 'user', [
        'company',
      ]);
      const result = await adapter.applyPagination(qb, {} as any);
      expect((result.data[0] as any).company).toEqual({
        id: 'c1',
        name: 'Acme',
      });
    });

    it('preserves rootIdsOrder over insertion order in two-phase', async () => {
      const adapter = new DrizzleAdapter();
      const stub = makeStubDb();
      stub.__setIdRows([{ id: 'u3' }, { id: 'u1' }, { id: 'u2' }]);
      // Phase 2 rows arrive in SQL ORDER BY which may differ.
      stub.__setRows([
        { user: { id: 'u1' }, posts: null },
        { user: { id: 'u2' }, posts: null },
        { user: { id: 'u3' }, posts: null },
      ]);
      stub.__setCount(3);

      const qb = adapter.createQueryBuilder(
        baseSource(stub.db, {
          relations: {
            posts: {
              table: posts,
              on: {} as any,
              cardinality: 'many',
              primaryKey: postsCols.id,
            },
          },
        }),
        'user'
      );
      adapter.applyIncludes(qb, { includes: 'posts' } as any, 'user', [
        'posts',
      ]);
      const result = await adapter.applyPagination(qb, {} as any);
      // Expect the order to follow rootIdsOrder = [u3, u1, u2].
      // Flat shape: root columns at top level — `id` is the user id directly.
      expect(result.data.map((r: any) => r.id)).toEqual(['u3', 'u1', 'u2']);
    });

    it('skips a 1:N row whose relation primaryKey is null (LEFT JOIN miss inside non-null object)', async () => {
      const adapter = new DrizzleAdapter();
      const stub = makeStubDb();
      stub.__setIdRows([{ id: 'u1' }]);
      stub.__setRows([
        // Drizzle can return relRow as a non-null object whose every column
        // is null when the LEFT JOIN does not match. The aggregator must
        // treat that as "no relation row" rather than push `{ id: null }`.
        {
          user: { id: 'u1', name: 'Ana' },
          posts: { id: null, title: null, userId: null },
        },
      ]);
      stub.__setCount(1);

      const qb = adapter.createQueryBuilder(
        baseSource(stub.db, {
          relations: {
            posts: {
              table: posts,
              on: {} as any,
              cardinality: 'many',
              primaryKey: postsCols.id,
            },
          },
        }),
        'user'
      );
      adapter.applyIncludes(qb, { includes: 'posts' } as any, 'user', [
        'posts',
      ]);
      const result = await adapter.applyPagination(qb, {} as any);
      expect((result.data[0] as any).posts).toEqual([]);
    });
  });

  describe('join promotion (presentation → where)', () => {
    it('promotes a join to whereJoins when a filter touches a relation already added by include', () => {
      const adapter = new DrizzleAdapter();
      const stub = makeStubDb();
      const qb = adapter.createQueryBuilder(
        baseSource(stub.db, {
          relations: { company: { table: companies, on: {} as any } },
        }),
        'user'
      );
      // First: include adds `company` as presentation.
      adapter.applyIncludes(qb, { includes: 'company' } as any, 'user', [
        'company',
      ]);
      expect(qb.presentationJoins.has('company')).toBe(true);
      expect(qb.whereJoins.has('company')).toBe(false);

      // Then: filter on `company.name` must promote it to whereJoins.
      adapter.applyFilters(
        qb,
        { filter: { 'company.name': { eq: 'Acme' } } } as any,
        'user',
        ['company']
      );
      expect(qb.presentationJoins.has('company')).toBe(false);
      expect(qb.whereJoins.has('company')).toBe(true);
    });
  });

  describe('applyFields — root primary key already requested', () => {
    it('does not duplicate the primary key when user passes id explicitly', () => {
      const adapter = new DrizzleAdapter();
      const stub = makeStubDb();
      const qb = adapter.createQueryBuilder(baseSource(stub.db), 'user');
      adapter.applyFields(qb, { fields: 'id,name,email' } as any, 'user', [
        'id',
        'name',
        'email',
      ]);
      const ids = qb.selectFields!.rootColumns.filter(
        (c) => c === usersCols.id
      );
      expect(ids).toHaveLength(1);
    });
  });

  describe('phase 2 stability sort', () => {
    it('appends asc(relationPK) for every "many" join in the data query for IDs', async () => {
      const adapter = new DrizzleAdapter();
      const stub = makeStubDb();
      stub.__setIdRows([{ id: 'u1' }]);
      stub.__setRows([{ user: { id: 'u1' }, posts: { id: 'p1', title: 'A' } }]);
      stub.__setCount(1);
      const qb = adapter.createQueryBuilder(
        baseSource(stub.db, {
          relations: {
            posts: {
              table: posts,
              on: {} as any,
              cardinality: 'many',
              primaryKey: postsCols.id,
            },
          },
        }),
        'user'
      );
      adapter.applyIncludes(qb, { includes: 'posts' } as any, 'user', [
        'posts',
      ]);
      await adapter.applyPagination(qb, {} as any);
      // The phase-2 select call should carry an ORDER BY entry for posts.id.
      const phase2 = stub.__calls.find(
        (c) => c.__kind === 'select' && c.__limit === undefined
      );
      expect(phase2.__orderBy.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('paginate=false (getMany)', () => {
    it('returns aggregated rows without count or limit', async () => {
      const adapter = new DrizzleAdapter();
      const stub = makeStubDb();
      stub.__setRows([
        { user: { id: 'u1', name: 'Ana' } },
        { user: { id: 'u2', name: 'Bia' } },
      ]);
      const qb = adapter.createQueryBuilder(baseSource(stub.db), 'user');
      const data = await adapter.getMany(qb);
      expect(data).toHaveLength(2);

      const dataCall = stub.__calls.find((c) => c.__kind === 'select');
      expect(dataCall.__limit).toBeUndefined();
      expect(dataCall.__offset).toBeUndefined();
      // No count call in getMany.
      expect(stub.__calls.find((c) => c.__kind === 'count')).toBeUndefined();
    });
  });

  describe('customize', () => {
    it('invokes the callback with the qb', () => {
      const adapter = new DrizzleAdapter();
      const stub = makeStubDb();
      const qb = adapter.createQueryBuilder(baseSource(stub.db), 'user');
      const fn = jest.fn();
      adapter.customize(qb, fn);
      expect(fn).toHaveBeenCalledWith(qb);
    });
  });
});
