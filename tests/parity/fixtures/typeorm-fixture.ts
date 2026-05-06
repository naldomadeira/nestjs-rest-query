/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * TypeORM fixture: a synthetic Repository whose `createQueryBuilder` returns
 * a QB stub that records every call without executing any SQL. Adapter
 * methods can be exercised end-to-end (including `applyPagination` →
 * `getManyAndCount`) and they always resolve to empty data.
 *
 * Schema: `user (id, name, email, age, createdAt)` with relations
 * `company` (one) and `posts` (many).
 */

function makeQbStub() {
  const journal = {
    wheres: [] as string[],
    joins: [] as Array<{ path: string; alias: string }>,
    selects: [] as string[][],
    orders: [] as Array<{ field: string; dir: 'ASC' | 'DESC' }>,
    skip: 0,
    take: 0,
  };

  const qb: any = {
    expressionMap: {
      mainAlias: { metadata: { relations: [] } },
      joinAttributes: [],
    },
    andWhere: (clause: string) => {
      journal.wheres.push(clause);
      return qb;
    },
    leftJoin: (path: string, alias: string) => {
      journal.joins.push({ path, alias });
      qb.expressionMap.joinAttributes.push({
        alias: { name: alias },
        entityOrProperty: path,
      });
      return qb;
    },
    leftJoinAndSelect: (path: string, alias: string) => {
      journal.joins.push({ path, alias });
      qb.expressionMap.joinAttributes.push({
        alias: { name: alias },
        entityOrProperty: path,
      });
      return qb;
    },
    select: (fields: string[]) => {
      journal.selects.push(fields);
      return qb;
    },
    addOrderBy: (field: string, dir: 'ASC' | 'DESC') => {
      journal.orders.push({ field, dir });
      return qb;
    },
    skip: (n: number) => {
      journal.skip = n;
      return qb;
    },
    take: (n: number) => {
      journal.take = n;
      return qb;
    },
    getMany: async () => [],
    getManyAndCount: async () => [[], 0] as [any[], number],
  };

  return { qb, journal };
}

export interface TypeOrmFixture {
  repository: any;
  alias: string;
}

export function makeTypeOrmFixture(): TypeOrmFixture {
  const { qb } = makeQbStub();
  const repository = {
    createQueryBuilder: () => qb,
  };
  return { repository, alias: 'user' };
}
