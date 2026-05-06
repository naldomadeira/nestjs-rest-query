/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Drizzle fixture: a synthetic DrizzleSource bound to fake table objects
 * shaped like Drizzle's table descriptors. The stub `db` returns chainable
 * accumulators that resolve to empty data, so adapter methods (including
 * `applyPagination`) execute without a real database.
 */

import type { DrizzleSource } from '@contracts/drizzle-source.interface';

function fakeColumn(tableName: string, columnName: string) {
  return {
    name: columnName,
    table: { _: { name: tableName } },
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

const usersCols = {
  id: fakeColumn('users', 'id'),
  email: fakeColumn('users', 'email'),
  name: fakeColumn('users', 'name'),
  age: fakeColumn('users', 'age'),
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

function makeStubDb() {
  function makeChain(kind: 'select' | 'selectDistinct' | 'count') {
    const builder: any = {};
    builder.from = () => builder;
    builder.$dynamic = () => builder;
    builder.leftJoin = () => builder;
    builder.where = () => builder;
    builder.orderBy = () => builder;
    builder.limit = () => builder;
    builder.offset = () => builder;
    builder.then = (resolve: any) => {
      if (kind === 'count') return resolve([{ value: 0 }]);
      return resolve([]);
    };
    return builder;
  }

  return {
    select: (shape: any) => {
      const isCount =
        shape &&
        typeof shape === 'object' &&
        Object.keys(shape).length === 1 &&
        'value' in shape;
      return makeChain(isCount ? 'count' : 'select');
    },
    selectDistinct: () => makeChain('selectDistinct'),
  };
}

export interface DrizzleFixture {
  source: DrizzleSource<any, any>;
  alias: string;
}

export function makeDrizzleFixture(): DrizzleFixture {
  const db = makeStubDb();

  const source: DrizzleSource<any, any> = {
    db,
    table: users,
    primaryKey: usersCols.id,
    relations: {
      company: { table: companies, on: {} as any },
      posts: {
        table: posts,
        on: {} as any,
        cardinality: 'many',
        primaryKey: postsCols.id,
      },
    },
    columnMap: {
      'company.name': companiesCols.name,
      'posts.title': postsCols.title,
      'posts.userId': postsCols.userId,
    },
  };

  return { source, alias: 'user' };
}
