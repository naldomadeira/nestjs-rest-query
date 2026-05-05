/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  PrismaAdapter,
  type PrismaQB,
} from '@src/infra/adapters/prisma.adapter';
import type {
  PrismaSource,
  PrismaRelation,
} from '@src/contracts/prisma-source.interface';

// ----------------------------------------------------------------------
// Mock the optional peer dep so the constructor's `require('@prisma/client')`
// succeeds. Tests that need to assert the missing-dep error temporarily
// override module resolution.
// ----------------------------------------------------------------------
jest.mock('@prisma/client', () => ({}), { virtual: true });

function makeDelegate(rows: any[] = [], total = 0) {
  return {
    findMany: jest.fn().mockResolvedValue(rows),
    count: jest.fn().mockResolvedValue(total),
  };
}

function makePrisma(model: string, rows: any[] = [], total = 0) {
  const delegate = makeDelegate(rows, total);
  const prisma: any = { [model]: delegate };
  return { prisma, delegate };
}

function userSource(
  prisma: any,
  overrides: Partial<PrismaSource> = {}
): PrismaSource {
  return {
    prisma,
    model: 'user',
    primaryKeyField: 'id',
    relations: {
      company: {
        cardinality: 'one',
        relations: { owner: { cardinality: 'one' } },
      },
      posts: {
        cardinality: 'many',
        relations: { tags: { cardinality: 'many' } },
      },
    },
    ...overrides,
  };
}

function makeQB(adapter: PrismaAdapter, source: PrismaSource): PrismaQB {
  return adapter.createQueryBuilder(source, 'user');
}

const adapter = new PrismaAdapter();

// ----------------------------------------------------------------------
// constructor + missing peer dep
// ----------------------------------------------------------------------

describe('PrismaAdapter constructor', () => {
  it('constructs when @prisma/client is available', () => {
    expect(() => new PrismaAdapter()).not.toThrow();
  });
});

// ----------------------------------------------------------------------
// applyFilters — operators
// ----------------------------------------------------------------------

describe('applyFilters: operator translation', () => {
  const source = userSource(makePrisma('user').prisma);
  const each = (
    field: string,
    op: string,
    value: any
  ): { qb: PrismaQB; whereFragment: any } => {
    const qb = makeQB(adapter, source);
    adapter.applyFilters(qb, { filter: { [field]: { [op]: value } } }, 'user', [
      'name',
      'age',
      'active',
    ]);
    return { qb, whereFragment: qb.where.AND[0] };
  };

  it('eq → { equals }', () => {
    expect(each('name', 'eq', 'ana').whereFragment).toEqual({
      name: { equals: 'ana' },
    });
  });
  it('ne → { not }', () => {
    expect(each('name', 'ne', 'ana').whereFragment).toEqual({
      name: { not: 'ana' },
    });
  });
  it('gt/gte/lt/lte', () => {
    expect(each('age', 'gt', 18).whereFragment).toEqual({ age: { gt: 18 } });
    expect(each('age', 'gte', 18).whereFragment).toEqual({ age: { gte: 18 } });
    expect(each('age', 'lt', 65).whereFragment).toEqual({ age: { lt: 65 } });
    expect(each('age', 'lte', 65).whereFragment).toEqual({ age: { lte: 65 } });
  });
  it('like → contains (literal, no wildcards)', () => {
    expect(each('name', 'like', 'jo').whereFragment).toEqual({
      name: { contains: 'jo' },
    });
  });
  it('ilike → contains + insensitive', () => {
    expect(each('name', 'ilike', 'jo').whereFragment).toEqual({
      name: { contains: 'jo', mode: 'insensitive' },
    });
  });
  it('notLike / notIlike', () => {
    expect(each('name', 'notLike', 'spam').whereFragment).toEqual({
      name: { not: { contains: 'spam' } },
    });
    expect(each('name', 'notIlike', 'spam').whereFragment).toEqual({
      name: { not: { contains: 'spam', mode: 'insensitive' } },
    });
  });
  it('in → { in }', () => {
    expect(each('name', 'in', 'a,b,c').whereFragment).toEqual({
      name: { in: ['a', 'b', 'c'] },
    });
  });
  it('notIn → { notIn }', () => {
    expect(each('name', 'notIn', 'a,b').whereFragment).toEqual({
      name: { notIn: ['a', 'b'] },
    });
  });
  it('between → { gte, lte }', () => {
    expect(each('age', 'between', '18,65').whereFragment).toEqual({
      age: { gte: 18, lte: 65 },
    });
  });
  it('isNull on scalar → null / { not: null }', () => {
    expect(each('name', 'isNull', 'true').whereFragment).toEqual({
      name: null,
    });
    expect(each('name', 'isNull', 'false').whereFragment).toEqual({
      name: { not: null },
    });
  });
});

describe('applyFilters: operatorsConfig.allowed', () => {
  const source = userSource(makePrisma('user').prisma);
  it('throws when an operator is not in the allowed list', () => {
    const qb = makeQB(adapter, source);
    expect(() =>
      adapter.applyFilters(
        qb,
        { filter: { name: { ilike: 'jo' } } },
        'user',
        ['name'],
        { allowed: ['eq'] }
      )
    ).toThrow(/Operator "ilike" is not allowed/);
  });
  it('passes through allowed operators', () => {
    const qb = makeQB(adapter, source);
    adapter.applyFilters(
      qb,
      { filter: { name: { eq: 'ana' } } },
      'user',
      ['name'],
      { allowed: ['eq'] }
    );
    expect(qb.where.AND[0]).toEqual({ name: { equals: 'ana' } });
  });
});

describe('applyFilters: value validation', () => {
  const source = userSource(makePrisma('user').prisma);
  it('throws BadRequest when in / notIn resolve to an empty array', () => {
    const qb = makeQB(adapter, source);
    expect(() =>
      adapter.applyFilters(qb, { filter: { name: { in: '' } } }, 'user', [
        'name',
      ])
    ).toThrow(/filter\[name\]\[in\] requires a non-empty array/);

    const qb2 = makeQB(adapter, source);
    expect(() =>
      adapter.applyFilters(qb2, { filter: { name: { notIn: [] } } }, 'user', [
        'name',
      ])
    ).toThrow(/filter\[name\]\[notIn\] requires a non-empty array/);
  });
  it('throws BadRequest when isNull is not boolean-like', () => {
    const qb = makeQB(adapter, source);
    expect(() =>
      adapter.applyFilters(
        qb,
        { filter: { company: { isNull: 'banana' } } },
        'user',
        ['company']
      )
    ).toThrow(/filter\[company\]\[isNull\] requires a boolean/);
  });
  it('throws BadRequest when an operator value is missing', () => {
    const qb = makeQB(adapter, source);
    expect(() =>
      adapter.applyFilters(
        qb,
        { filter: { name: { eq: undefined } } } as any,
        'user',
        ['name']
      )
    ).toThrow(/filter\[name\]\[eq\] requires a value/);
  });
  it('throws BadRequest when collection operators contain undefined values', () => {
    const qb = makeQB(adapter, source);
    expect(() =>
      adapter.applyFilters(
        qb,
        { filter: { name: { in: ['ana', undefined] } } } as any,
        'user',
        ['name']
      )
    ).toThrow(/filter\[name\]\[in\] requires a value/);

    const qb2 = makeQB(adapter, source);
    expect(() =>
      adapter.applyFilters(
        qb2,
        { filter: { age: { between: [18, undefined] } } } as any,
        'user',
        ['age']
      )
    ).toThrow(/filter\[age\]\[between\] requires exactly two values/);
  });
  it('throws BadRequest when between has wrong arity', () => {
    const qb = makeQB(adapter, source);
    expect(() =>
      adapter.applyFilters(qb, { filter: { age: { between: '18' } } }, 'user', [
        'age',
      ])
    ).toThrow(/between.*expects exactly 2/);
  });
  it('throws BadRequest when between is malformed', () => {
    const qb = makeQB(adapter, source);
    expect(() =>
      adapter.applyFilters(qb, { filter: { age: { between: 42 } } }, 'user', [
        'age',
      ])
    ).toThrow(/array or comma-separated string/);
  });
  it('throws BadRequest on unknown operator', () => {
    const qb = makeQB(adapter, source);
    expect(() =>
      adapter.applyFilters(qb, { filter: { name: { weird: 'x' } } }, 'user', [
        'name',
      ])
    ).toThrow(/Unsupported operator "weird"/);
  });
  it('throws BadRequest on unsafe field path', () => {
    const qb = makeQB(adapter, source);
    expect(() =>
      adapter.applyFilters(
        qb,
        { filter: { 'bad name!': { eq: 'x' } } as any },
        'user',
        ['name']
      )
    ).toThrow(/Invalid filter field name/);
  });
  it('throws BadRequest when field is not whitelisted', () => {
    const qb = makeQB(adapter, source);
    expect(() =>
      adapter.applyFilters(qb, { filter: { secret: { eq: 'x' } } }, 'user', [
        'name',
      ])
    ).toThrow(/not allowed/);
  });
});

// ----------------------------------------------------------------------
// applyFilters — relation traversal
// ----------------------------------------------------------------------

describe('applyFilters: relation traversal', () => {
  const source = userSource(makePrisma('user').prisma);
  it("'one' relation → nested object", () => {
    const qb = makeQB(adapter, source);
    adapter.applyFilters(
      qb,
      { filter: { 'company.name': { eq: 'Acme' } } },
      'user',
      ['company']
    );
    expect(qb.where.AND[0]).toEqual({
      company: { name: { equals: 'Acme' } },
    });
  });
  it("'many' relation → wraps in some", () => {
    const qb = makeQB(adapter, source);
    adapter.applyFilters(
      qb,
      { filter: { 'posts.title': { ilike: 'hello' } } },
      'user',
      ['posts']
    );
    expect(qb.where.AND[0]).toEqual({
      posts: { some: { title: { contains: 'hello', mode: 'insensitive' } } },
    });
  });
  it("deep 'many' chain wraps each many hop independently", () => {
    const qb = makeQB(adapter, source);
    adapter.applyFilters(
      qb,
      { filter: { 'posts.tags.label': { eq: 'urgent' } } },
      'user',
      ['posts']
    );
    expect(qb.where.AND[0]).toEqual({
      posts: { some: { tags: { some: { label: { equals: 'urgent' } } } } },
    });
  });
  it('throws BadRequest when a relation hop is missing in PrismaSource.relations', () => {
    const qb = makeQB(adapter, source);
    expect(() =>
      adapter.applyFilters(
        qb,
        { filter: { 'unknown.name': { eq: 'x' } } },
        'user',
        ['unknown']
      )
    ).toThrow(/Unknown relation 'unknown'/);
  });
  it('isNull on a one-relation leaf emits is/isNot null', () => {
    const qb = makeQB(adapter, source);
    adapter.applyFilters(
      qb,
      { filter: { company: { isNull: 'true' } } },
      'user',
      ['company']
    );
    expect(qb.where.AND[0]).toEqual({ company: { is: null } });
    const qb2 = makeQB(adapter, source);
    adapter.applyFilters(
      qb2,
      { filter: { company: { isNull: 'false' } } },
      'user',
      ['company']
    );
    expect(qb2.where.AND[0]).toEqual({ company: { isNot: null } });
  });
  it('isNull on a many relation throws BadRequest', () => {
    const qb = makeQB(adapter, source);
    expect(() =>
      adapter.applyFilters(
        qb,
        { filter: { posts: { isNull: 'true' } } },
        'user',
        ['posts']
      )
    ).toThrow(/not supported on to-many/);
  });
});

describe('applyFilters: repeated filters always stack under AND', () => {
  const source = userSource(makePrisma('user').prisma);
  it('two operators on the same field push two AND fragments', () => {
    const qb = makeQB(adapter, source);
    adapter.applyFilters(
      qb,
      { filter: { name: { ilike: 'ana', notIlike: 'spam' } } },
      'user',
      ['name']
    );
    expect(qb.where.AND).toEqual([
      { name: { contains: 'ana', mode: 'insensitive' } },
      { name: { not: { contains: 'spam', mode: 'insensitive' } } },
    ]);
  });
});

// ----------------------------------------------------------------------
// applySorts
// ----------------------------------------------------------------------

describe('applySorts', () => {
  const source = userSource(makePrisma('user').prisma);
  it('sorts root fields with direction', () => {
    const qb = makeQB(adapter, source);
    adapter.applySorts(qb, { sort: 'name,-age' }, 'user', ['name', 'age']);
    expect(qb.orderBy).toEqual([{ name: 'asc' }, { age: 'desc' }]);
  });
  it("sorts on 'one' relation field", () => {
    const qb = makeQB(adapter, source);
    adapter.applySorts(qb, { sort: '-company.name' }, 'user', ['company']);
    expect(qb.orderBy).toEqual([{ company: { name: 'desc' } }]);
  });
  it("rejects sort through 'many' relation with locked wording", () => {
    const qb = makeQB(adapter, source);
    expect(() =>
      adapter.applySorts(qb, { sort: 'posts.createdAt' }, 'user', ['posts'])
    ).toThrow(
      /Cannot sort by 'posts\.createdAt': sorting through to-many relations is not supported\./
    );
  });
  it('rejects sort field outside the whitelist', () => {
    const qb = makeQB(adapter, source);
    expect(() =>
      adapter.applySorts(qb, { sort: 'secret' }, 'user', ['name'])
    ).toThrow(/Sort field\(s\) not allowed/);
  });
});

// ----------------------------------------------------------------------
// applyIncludes
// ----------------------------------------------------------------------

describe('applyIncludes', () => {
  const source = userSource(makePrisma('user').prisma);
  it('builds tree for root and nested', () => {
    const qb = makeQB(adapter, source);
    adapter.applyIncludes(qb, { includes: 'company,company.owner' }, 'user', [
      'company',
    ]);
    expect(qb.include).toEqual({
      company: { include: { owner: true } },
    });
  });
  it('merge order is stable: more specific first OR last → same result', () => {
    const qb1 = makeQB(adapter, source);
    adapter.applyIncludes(qb1, { includes: 'company,company.owner' }, 'user', [
      'company',
    ]);
    const qb2 = makeQB(adapter, source);
    adapter.applyIncludes(qb2, { includes: 'company.owner,company' }, 'user', [
      'company',
    ]);
    expect(qb1.include).toEqual(qb2.include);
  });
  it('throws when an include hop is missing in relations metadata', () => {
    const qb = makeQB(adapter, source);
    expect(() =>
      adapter.applyIncludes(qb, { includes: 'ghost' }, 'user', ['ghost'])
    ).toThrow(/Unknown relation 'ghost'/);
  });
  it('throws when an include is not whitelisted', () => {
    const qb = makeQB(adapter, source);
    expect(() =>
      adapter.applyIncludes(qb, { includes: 'posts' }, 'user', ['company'])
    ).toThrow(/Include path\(s\) not allowed/);
  });
});

// ----------------------------------------------------------------------
// applySearch
// ----------------------------------------------------------------------

describe('applySearch', () => {
  const source = userSource(makePrisma('user').prisma);
  it('builds OR across whitelisted fields, including some on many', () => {
    const qb = makeQB(adapter, source);
    adapter.applySearch(qb, { search: 'acme' }, 'user', [
      'name',
      'company.name',
      'posts.title',
    ]);
    expect(qb.where.AND).toHaveLength(1);
    expect(qb.where.AND[0]).toEqual({
      OR: [
        { name: { contains: 'acme', mode: 'insensitive' } },
        { company: { name: { contains: 'acme', mode: 'insensitive' } } },
        {
          posts: {
            some: { title: { contains: 'acme', mode: 'insensitive' } },
          },
        },
      ],
    });
  });
  it('throws when a search hop is missing from relations', () => {
    const qb = makeQB(adapter, source);
    expect(() =>
      adapter.applySearch(qb, { search: 'x' }, 'user', ['nope.name'])
    ).toThrow(/Unknown relation 'nope'/);
  });
  it('no-op on empty search term', () => {
    const qb = makeQB(adapter, source);
    adapter.applySearch(qb, { search: '   ' }, 'user', ['name']);
    expect(qb.where.AND).toEqual([]);
  });
});

// ----------------------------------------------------------------------
// applyFields
// ----------------------------------------------------------------------

describe('applyFields', () => {
  const source = userSource(makePrisma('user').prisma);
  it('auto-injects root PK', () => {
    const qb = makeQB(adapter, source);
    adapter.applyFields(qb, { fields: 'name' }, 'user', ['name']);
    expect(qb.select).toEqual({ id: true, name: true });
  });
  it('honors source.primaryKeyField when not "id"', () => {
    const customSource = userSource(makePrisma('user').prisma, {
      primaryKeyField: 'uuid',
    });
    const qb = makeQB(adapter, customSource);
    adapter.applyFields(qb, { fields: 'name' }, 'user', ['name']);
    expect(qb.select).toEqual({ uuid: true, name: true });
  });
  it('builds nested select for dotted field paths', () => {
    const qb = makeQB(adapter, source);
    adapter.applyFields(qb, { fields: 'name,company.name' }, 'user', [
      'name',
      'company',
    ]);
    expect(qb.select).toEqual({
      id: true,
      name: true,
      company: { select: { name: true } },
    });
  });
  it('rejects a direct relation field to avoid auto-expanding relation columns', () => {
    const qb = makeQB(adapter, source);
    expect(() =>
      adapter.applyFields(qb, { fields: 'company' }, 'user', ['company'])
    ).toThrow(/Field "company" cannot be a relation/);
  });
  it('fields + includes: relation reduced to PK, include cleared', () => {
    const qb = makeQB(adapter, source);
    adapter.applyIncludes(qb, { includes: 'company' }, 'user', ['company']);
    adapter.applyFields(qb, { fields: 'name' }, 'user', ['name'], ['company']);
    expect(qb.select).toEqual({
      id: true,
      name: true,
      company: { select: { id: true } },
    });
    expect(qb.include).toBeUndefined();
  });
  it('fields=company.name + includes=company → coherent select with PK + name', () => {
    const qb = makeQB(adapter, source);
    adapter.applyIncludes(qb, { includes: 'company' }, 'user', ['company']);
    adapter.applyFields(
      qb,
      { fields: 'name,company.name' },
      'user',
      ['name', 'company'],
      ['company']
    );
    expect(qb.select).toEqual({
      id: true,
      name: true,
      company: { select: { id: true, name: true } },
    });
    expect(qb.include).toBeUndefined();
  });
  it('honors PrismaRelation.primaryKeyField when not "id"', () => {
    const customRelations: Record<string, PrismaRelation> = {
      company: {
        cardinality: 'one',
        primaryKeyField: 'uuid',
      },
    };
    const customSource = userSource(makePrisma('user').prisma, {
      relations: customRelations,
    });
    const qb = makeQB(adapter, customSource);
    adapter.applyIncludes(qb, { includes: 'company' }, 'user', ['company']);
    adapter.applyFields(qb, { fields: 'name' }, 'user', ['name'], ['company']);
    expect(qb.select!.company).toEqual({ select: { uuid: true } });
  });
  it('rejects fields outside the whitelist', () => {
    const qb = makeQB(adapter, source);
    expect(() =>
      adapter.applyFields(qb, { fields: 'secret' }, 'user', ['name'])
    ).toThrow(/Field\(s\) not allowed/);
  });
});

// ----------------------------------------------------------------------
// applyPagination + getMany + customize
// ----------------------------------------------------------------------

describe('applyPagination', () => {
  it('calls findMany and count with aligned where (compacted)', async () => {
    const { prisma, delegate } = makePrisma('user', [{ id: 1 }, { id: 2 }], 42);
    const source = userSource(prisma);
    const qb = makeQB(adapter, source);
    adapter.applyFilters(qb, { filter: { name: { eq: 'ana' } } }, 'user', [
      'name',
    ]);

    const result = await adapter.applyPagination(qb, {
      page: '2',
      perPage: '10',
    });

    expect(result).toEqual({
      data: [{ id: 1 }, { id: 2 }],
      page: 2,
      perPage: 10,
      total: 42,
      lastPage: 5,
    });
    expect(delegate.findMany).toHaveBeenCalledWith({
      where: { name: { equals: 'ana' } },
      take: 10,
      skip: 10,
    });
    expect(delegate.count).toHaveBeenCalledWith({
      where: { name: { equals: 'ana' } },
    });
  });
  it('respects post-customize where mutation (snapshot is post-customize)', async () => {
    const { prisma, delegate } = makePrisma('user', [], 0);
    const source = userSource(prisma);
    const qb = makeQB(adapter, source);
    // customize mutates qb.where after buildQuery
    adapter.customize(qb, (q) => {
      q.where.AND.push({ tenantId: 'tenant-1' });
    });
    await adapter.applyPagination(qb, {});
    const findArg = (delegate.findMany.mock.calls[0] as any[])[0];
    const countArg = (delegate.count.mock.calls[0] as any[])[0];
    expect(findArg.where).toEqual({ tenantId: 'tenant-1' });
    expect(countArg.where).toEqual({ tenantId: 'tenant-1' });
  });
  it('rejects page < 1 / perPage < 1', async () => {
    const { prisma } = makePrisma('user');
    const qb = makeQB(adapter, userSource(prisma));
    await expect(adapter.applyPagination(qb, { page: '0' })).rejects.toThrow(
      /page.*>= 1/
    );
  });
});

describe('getMany', () => {
  it('calls findMany without take/skip and never count', async () => {
    const { prisma, delegate } = makePrisma('user', [{ id: 1 }]);
    const qb = makeQB(adapter, userSource(prisma));
    const rows = await adapter.getMany(qb);
    expect(rows).toEqual([{ id: 1 }]);
    expect(delegate.findMany).toHaveBeenCalledTimes(1);
    expect(delegate.count).not.toHaveBeenCalled();
    const findArg = (delegate.findMany.mock.calls[0] as any[])[0];
    expect(findArg.take).toBeUndefined();
    expect(findArg.skip).toBeUndefined();
  });
});

describe('customize', () => {
  it('receives the internal PrismaQB accumulator (not findMany args, not delegate)', () => {
    const { prisma } = makePrisma('user');
    const qb = makeQB(adapter, userSource(prisma));
    let captured: PrismaQB | undefined;
    adapter.customize(qb, (q) => {
      captured = q;
    });
    expect(captured).toBe(qb);
    expect(captured!.where).toBeDefined();
    expect(captured!.orderBy).toBeDefined();
    // Sanity: not args, not delegate
    expect((captured as any).findMany).toBeUndefined();
    expect((captured as any).take).toBeUndefined();
  });
});
