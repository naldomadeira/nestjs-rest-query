/* eslint-disable @typescript-eslint/no-explicit-any */
import { QueryBuilderService } from '@src/core/query-builder.service';
import { TypeOrmAdapter } from '@src/infra/adapters';
import type { RestQueryAdapter } from '@src/contracts';
import { createMockQb } from '../utils/mock-query-builder';

function makeRepo(qb = createMockQb()) {
  return {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
  } as any;
}

function makeFakeAdapter(): RestQueryAdapter<any, any> & {
  applyFilters: jest.Mock;
  applyIncludes: jest.Mock;
  applySearch: jest.Mock;
  applyFields: jest.Mock;
  applySorts: jest.Mock;
  applyPagination: jest.Mock;
  getMany: jest.Mock;
  customize: jest.Mock;
  createQueryBuilder: jest.Mock;
} {
  const qb = { __fake: true };
  return {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    applyFilters: jest.fn(),
    applyIncludes: jest.fn(),
    applySearch: jest.fn(),
    applyFields: jest.fn(),
    applySorts: jest.fn(),
    applyPagination: jest
      .fn()
      .mockResolvedValue({ data: [], page: 1, perPage: 10, total: 0, lastPage: 1 }),
    getMany: jest.fn().mockResolvedValue([]),
    customize: jest.fn((q: any, fn: (q: any) => void) => fn(q)),
  };
}

describe('QueryBuilderService — adapter integration (Phase 1)', () => {
  describe('adapter resolution', () => {
    it('uses TypeOrmAdapter by default when no config is provided', () => {
      const service = new QueryBuilderService();
      const adapter = (service as any).adapter;
      expect(adapter).toBeInstanceOf(TypeOrmAdapter);
    });

    it('uses TypeOrmAdapter when forRoot({}) is provided without adapter', () => {
      const service = new QueryBuilderService({});
      const adapter = (service as any).adapter;
      expect(adapter).toBeInstanceOf(TypeOrmAdapter);
    });

    it('uses the provided adapter when one is configured', () => {
      const fake = makeFakeAdapter();
      const service = new QueryBuilderService({ adapter: fake });
      const adapter = (service as any).adapter;
      expect(adapter).toBe(fake);
    });
  });

  describe('buildQuery delegates to adapter methods', () => {
    it('calls createQueryBuilder with the source and alias', () => {
      const fake = makeFakeAdapter();
      const service = new QueryBuilderService({ adapter: fake });
      const repo = {} as any;
      service.buildQuery(repo, {}, { alias: 'users' });
      expect(fake.createQueryBuilder).toHaveBeenCalledWith(repo, 'users');
    });

    it('only invokes adapter methods for rules that are present', () => {
      const fake = makeFakeAdapter();
      const service = new QueryBuilderService({ adapter: fake });
      service.buildQuery({} as any, {}, { filters: ['email'] });

      expect(fake.applyFilters).toHaveBeenCalledTimes(1);
      expect(fake.applyIncludes).not.toHaveBeenCalled();
      expect(fake.applySearch).not.toHaveBeenCalled();
      expect(fake.applyFields).not.toHaveBeenCalled();
      expect(fake.applySorts).not.toHaveBeenCalled();
    });

    it('invokes every adapter method when full rules are provided', () => {
      const fake = makeFakeAdapter();
      const service = new QueryBuilderService({ adapter: fake });
      service.buildQuery(
        {} as any,
        {},
        {
          filters: ['email'],
          includes: ['company'],
          search: ['name'],
          fields: ['id', 'name'],
          sorts: ['createdAt'],
        },
      );

      expect(fake.applyFilters).toHaveBeenCalledTimes(1);
      expect(fake.applyIncludes).toHaveBeenCalledTimes(1);
      expect(fake.applySearch).toHaveBeenCalledTimes(1);
      expect(fake.applyFields).toHaveBeenCalledTimes(1);
      expect(fake.applySorts).toHaveBeenCalledTimes(1);
    });
  });

  describe('execute branches paginate=false vs paginate=true', () => {
    it('paginate=true (default) calls adapter.applyPagination and returns full envelope', async () => {
      const fake = makeFakeAdapter();
      fake.applyPagination.mockResolvedValueOnce({
        data: [{ id: 1 }],
        page: 1,
        perPage: 10,
        total: 1,
        lastPage: 1,
      });
      const service = new QueryBuilderService({ adapter: fake });
      const result = await service.execute({} as any, {}, {});
      expect(fake.applyPagination).toHaveBeenCalledTimes(1);
      expect(fake.getMany).not.toHaveBeenCalled();
      expect(result).toEqual({
        data: [{ id: 1 }],
        page: 1,
        perPage: 10,
        total: 1,
        lastPage: 1,
      });
    });

    it('paginate=false calls adapter.getMany and returns { data } only', async () => {
      const fake = makeFakeAdapter();
      fake.getMany.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);
      const service = new QueryBuilderService({ adapter: fake });
      const result = await service.execute(
        {} as any,
        { paginate: 'false' as any },
        {},
      );
      expect(fake.getMany).toHaveBeenCalledTimes(1);
      expect(fake.applyPagination).not.toHaveBeenCalled();
      expect(result).toEqual({ data: [{ id: 1 }, { id: 2 }] });
      expect(result).not.toHaveProperty('page');
      expect(result).not.toHaveProperty('total');
    });

    it('paginate=true with explicit value still uses applyPagination', async () => {
      const fake = makeFakeAdapter();
      const service = new QueryBuilderService({ adapter: fake });
      await service.execute({} as any, { paginate: 'true' as any }, {});
      expect(fake.applyPagination).toHaveBeenCalledTimes(1);
      expect(fake.getMany).not.toHaveBeenCalled();
    });
  });

  describe('customize hook is delegated through adapter.customize', () => {
    it('invokes adapter.customize when callback is provided', async () => {
      const fake = makeFakeAdapter();
      const service = new QueryBuilderService({ adapter: fake });
      const cb = jest.fn();
      await service.execute({} as any, {}, {}, cb);
      expect(fake.customize).toHaveBeenCalledTimes(1);
      expect(fake.customize.mock.calls[0][1]).toBe(cb);
    });

    it('does not invoke adapter.customize when no callback is provided', async () => {
      const fake = makeFakeAdapter();
      const service = new QueryBuilderService({ adapter: fake });
      await service.execute({} as any, {}, {});
      expect(fake.customize).not.toHaveBeenCalled();
    });
  });

  describe('TypeOrmAdapter direct usage (sanity)', () => {
    it('createQueryBuilder forwards to repository.createQueryBuilder', () => {
      const adapter = new TypeOrmAdapter();
      const qb = createMockQb();
      const repo = makeRepo(qb);
      const result = adapter.createQueryBuilder(repo, 'root');
      expect(repo.createQueryBuilder).toHaveBeenCalledWith('root');
      expect(result).toBe(qb);
    });

    it('getMany forwards to qb.getMany', async () => {
      const adapter = new TypeOrmAdapter();
      const qb = createMockQb();
      qb.getMany = jest.fn().mockResolvedValue([{ id: 9 }]);
      const data = await adapter.getMany(qb as any);
      expect(qb.getMany).toHaveBeenCalled();
      expect(data).toEqual([{ id: 9 }]);
    });

    it('customize invokes the callback with the qb', () => {
      const adapter = new TypeOrmAdapter();
      const qb = createMockQb();
      const fn = jest.fn();
      adapter.customize(qb as any, fn);
      expect(fn).toHaveBeenCalledWith(qb);
    });
  });
});
