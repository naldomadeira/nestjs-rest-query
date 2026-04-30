/* eslint-disable @typescript-eslint/no-explicit-any */

export interface MockQueryBuilderCall {
  condition: string;
  params: object;
}

export interface MockQueryBuilder {
  andWhere: jest.Mock;
  addOrderBy: jest.Mock;
  leftJoinAndSelect: jest.Mock;
  select: jest.Mock;
  skip: jest.Mock;
  take: jest.Mock;
  getManyAndCount: jest.Mock;
  getMany: jest.Mock;
  _andWhereCalls: MockQueryBuilderCall[];
}

export function createMockQb(data: any[] = [], total = 0): MockQueryBuilder {
  const andWhereCalls: MockQueryBuilderCall[] = [];

  const qb: MockQueryBuilder = {
    andWhere: jest.fn((condition: string, params?: object) => {
      andWhereCalls.push({ condition, params: params ?? {} });
      return qb;
    }),
    addOrderBy: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([data, total]),
    getMany: jest.fn().mockResolvedValue(data),
    _andWhereCalls: andWhereCalls,
  };

  return qb;
}
