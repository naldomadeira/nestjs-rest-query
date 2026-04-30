import { BadRequestException } from '@nestjs/common';
import { QueryBuilderService } from '@src/core/query-builder.service';
import { QueryInput, RulesConfig } from '@src/contracts';
import { createMockQb } from '../utils/mock-query-builder';

function makeRepo(qb = createMockQb()) {
  return {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
  } as any;
}

describe('QueryBuilderService', () => {
  describe('buildQuery', () => {
    it('calls createQueryBuilder with the rules alias', () => {
      const service = new QueryBuilderService();
      const repo = makeRepo();
      const rules: RulesConfig = { alias: 'company', filters: ['name'] };
      service.buildQuery(repo, {}, rules);
      expect(repo.createQueryBuilder).toHaveBeenCalledWith('company');
    });

    it('defaults alias to "root" when not set', () => {
      const service = new QueryBuilderService();
      const repo = makeRepo();
      service.buildQuery(repo, {}, {});
      expect(repo.createQueryBuilder).toHaveBeenCalledWith('root');
    });

    it('returns the SelectQueryBuilder', () => {
      const service = new QueryBuilderService();
      const qb = createMockQb();
      const repo = makeRepo(qb);
      const result = service.buildQuery(repo, {}, {});
      expect(result).toBe(qb);
    });

    it('applies filters when rules.filters is set', () => {
      const service = new QueryBuilderService();
      const qb = createMockQb();
      const repo = makeRepo(qb);
      const query: QueryInput = { filter: { name: 'Acme' } };
      service.buildQuery(repo, query, { filters: ['name'] });
      expect(qb.andWhere).toHaveBeenCalledTimes(1);
    });

    it('does not apply filters when rules.filters is empty', () => {
      const service = new QueryBuilderService();
      const qb = createMockQb();
      const repo = makeRepo(qb);
      service.buildQuery(repo, { filter: { name: 'Acme' } }, { filters: [] });
      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it('applies sorts when rules.sorts is set', () => {
      const service = new QueryBuilderService();
      const qb = createMockQb();
      const repo = makeRepo(qb);
      service.buildQuery(repo, { sort: 'name' }, { sorts: ['name'] });
      expect(qb.addOrderBy).toHaveBeenCalledWith('root.name', 'ASC');
    });

    it('does not apply sorts when rules.sorts is empty', () => {
      const service = new QueryBuilderService();
      const qb = createMockQb();
      const repo = makeRepo(qb);
      service.buildQuery(repo, { sort: 'name' }, { sorts: [] });
      expect(qb.addOrderBy).not.toHaveBeenCalled();
    });

    it('applies includes when rules.includes is set', () => {
      const service = new QueryBuilderService();
      const qb = createMockQb();
      const repo = makeRepo(qb);
      service.buildQuery(
        repo,
        { includes: 'category' },
        { includes: ['category'] }
      );
      expect(qb.leftJoinAndSelect).toHaveBeenCalledTimes(1);
    });

    it('applies field selection when rules.fields is set', () => {
      const service = new QueryBuilderService();
      const qb = createMockQb();
      const repo = makeRepo(qb);
      service.buildQuery(
        repo,
        { fields: 'id,name' },
        { fields: ['id', 'name'] }
      );
      expect(qb.select).toHaveBeenCalledTimes(1);
    });

    it('propagates operatorsConfig from global config to applyFilters', () => {
      const service = new QueryBuilderService({
        operators: { allowed: ['eq'] },
      });
      const qb = createMockQb();
      const repo = makeRepo(qb);
      expect(() =>
        service.buildQuery(
          repo,
          { filter: { name: { like: 'Acme' } } },
          { filters: ['name'] }
        )
      ).toThrow(BadRequestException);
    });

    it('does not throw when filter uses allowed operator from config', () => {
      const service = new QueryBuilderService({
        operators: { allowed: ['eq', 'like'] },
      });
      const qb = createMockQb();
      const repo = makeRepo(qb);
      expect(() =>
        service.buildQuery(
          repo,
          { filter: { name: { like: 'Acme' } } },
          { filters: ['name'] }
        )
      ).not.toThrow();
    });
  });

  describe('execute', () => {
    it('returns paginated result by default', async () => {
      const service = new QueryBuilderService();
      const qb = createMockQb([{ id: 1 }], 1);
      const repo = makeRepo(qb);
      const result = await service.execute(repo, {}, {});
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
    });

    it('returns unpaginated result when paginate=false', async () => {
      const service = new QueryBuilderService();
      const qb = createMockQb([{ id: 1 }, { id: 2 }]);
      const repo = makeRepo(qb);
      const result = await service.execute(repo, { paginate: 'false' }, {});
      expect(result).toEqual({ data: [{ id: 1 }, { id: 2 }] });
      expect(result).not.toHaveProperty('total');
    });

    it('calls customize callback with the query builder', async () => {
      const service = new QueryBuilderService();
      const qb = createMockQb();
      const repo = makeRepo(qb);
      const customize = jest.fn();
      await service.execute(repo, {}, {}, customize);
      expect(customize).toHaveBeenCalledWith(qb);
    });

    it('customize can add extra andWhere conditions', async () => {
      const service = new QueryBuilderService();
      const qb = createMockQb();
      const repo = makeRepo(qb);
      await service.execute(repo, {}, {}, (q) => {
        q.andWhere('root.active = :active', { active: true });
      });
      expect(qb.andWhere).toHaveBeenCalledWith('root.active = :active', {
        active: true,
      });
    });

    it('does not call customize when not provided', async () => {
      const service = new QueryBuilderService();
      const repo = makeRepo();
      await expect(service.execute(repo, {}, {})).resolves.not.toThrow();
    });

    it('applies pagination config from constructor', async () => {
      const service = new QueryBuilderService({
        pagination: { defaultPerPage: 5 },
      });
      const qb = createMockQb([], 0);
      const repo = makeRepo(qb);
      await service.execute(repo, {}, {});
      expect(qb.take).toHaveBeenCalledWith(5);
    });
  });
});
