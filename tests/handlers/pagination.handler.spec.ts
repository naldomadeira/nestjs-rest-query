import { BadRequestException } from '@nestjs/common';
import { applyPagination } from '@src/domain/handlers/pagination.handler';

function createPaginationQb(data: object[] = [], total = 0) {
  const qb: any = {
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([data, total]),
  };
  return qb;
}

describe('applyPagination', () => {
  describe('default parameters', () => {
    it('uses page=1 and perPage=10 when not provided', async () => {
      const qb = createPaginationQb([], 0);
      await applyPagination(qb, {});
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(10);
    });

    it('returns the expected QueryResult shape', async () => {
      const data = [{ id: 1 }, { id: 2 }];
      const qb = createPaginationQb(data, 2);
      const result = await applyPagination(qb, {});
      expect(result).toEqual({
        data,
        page: 1,
        perPage: 10,
        total: 2,
        lastPage: 1,
      });
    });
  });

  describe('offset calculation', () => {
    it('computes skip = (page - 1) * perPage', async () => {
      const qb = createPaginationQb();
      await applyPagination(qb, { page: '2', perPage: '10' });
      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(qb.take).toHaveBeenCalledWith(10);
    });

    it('computes correct skip for page=3, perPage=5', async () => {
      const qb = createPaginationQb();
      await applyPagination(qb, { page: '3', perPage: '5' });
      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(qb.take).toHaveBeenCalledWith(5);
    });

    it('computes skip=0 for page=1', async () => {
      const qb = createPaginationQb();
      await applyPagination(qb, { page: '1', perPage: '1' });
      expect(qb.skip).toHaveBeenCalledWith(0);
    });
  });

  describe('config — defaultPerPage', () => {
    it('uses config.defaultPerPage when perPage is not provided', async () => {
      const qb = createPaginationQb();
      await applyPagination(qb, {}, { defaultPerPage: 25 });
      expect(qb.take).toHaveBeenCalledWith(25);
    });

    it('uses config.defaultPerPage=50', async () => {
      const qb = createPaginationQb();
      await applyPagination(qb, {}, { defaultPerPage: 50 });
      expect(qb.take).toHaveBeenCalledWith(50);
    });
  });

  describe('config — maxPerPage', () => {
    it('clamps perPage to config.maxPerPage when requested value is higher', async () => {
      const qb = createPaginationQb();
      await applyPagination(qb, { perPage: '100' }, { maxPerPage: 20 });
      expect(qb.take).toHaveBeenCalledWith(20);
    });

    it('respects requested perPage when it is below maxPerPage', async () => {
      const qb = createPaginationQb();
      await applyPagination(qb, { perPage: '10' }, { maxPerPage: 20 });
      expect(qb.take).toHaveBeenCalledWith(10);
    });

    it('applies default maxPerPage=100 when no config is provided', async () => {
      const qb = createPaginationQb();
      await applyPagination(qb, { perPage: '200' });
      expect(qb.take).toHaveBeenCalledWith(100);
    });
  });

  describe('lastPage calculation', () => {
    it('returns lastPage=1 when total=0 (never zero)', async () => {
      const qb = createPaginationQb([], 0);
      const result = await applyPagination(qb, { perPage: '10' });
      expect(result.lastPage).toBe(1);
    });

    it('returns lastPage=1 when total equals perPage', async () => {
      const qb = createPaginationQb([], 10);
      const result = await applyPagination(qb, { perPage: '10' });
      expect(result.lastPage).toBe(1);
    });

    it('returns lastPage=2 when total is one more than perPage', async () => {
      const qb = createPaginationQb([], 11);
      const result = await applyPagination(qb, { perPage: '10' });
      expect(result.lastPage).toBe(2);
    });

    it('returns lastPage=10 when total=100 and perPage=10', async () => {
      const qb = createPaginationQb([], 100);
      const result = await applyPagination(qb, { perPage: '10' });
      expect(result.lastPage).toBe(10);
    });

    it('returns lastPage=11 when total=101 and perPage=10', async () => {
      const qb = createPaginationQb([], 101);
      const result = await applyPagination(qb, { perPage: '10' });
      expect(result.lastPage).toBe(11);
    });
  });

  describe('QueryResult structure', () => {
    it('always returns data, page, perPage, total, lastPage', async () => {
      const data = [{ id: 1 }];
      const qb = createPaginationQb(data, 1);
      const result = await applyPagination(qb, { page: '1', perPage: '10' });
      expect(result).toHaveProperty('data', data);
      expect(result).toHaveProperty('page', 1);
      expect(result).toHaveProperty('perPage', 10);
      expect(result).toHaveProperty('total', 1);
      expect(result).toHaveProperty('lastPage', 1);
    });

    it('data is the array returned by getManyAndCount', async () => {
      const data = [{ id: 99 }];
      const qb = createPaginationQb(data, 1);
      const result = await applyPagination(qb, {});
      expect(result.data).toBe(data);
    });
  });

  describe('parameter validation', () => {
    it('throws BadRequestException when page=0', async () => {
      const qb = createPaginationQb();
      await expect(applyPagination(qb, { page: '0' })).rejects.toThrow(
        BadRequestException
      );
    });

    it('throws BadRequestException when page is negative', async () => {
      const qb = createPaginationQb();
      await expect(applyPagination(qb, { page: '-1' })).rejects.toThrow(
        BadRequestException
      );
    });

    it('throws BadRequestException when perPage=0', async () => {
      const qb = createPaginationQb();
      await expect(applyPagination(qb, { perPage: '0' })).rejects.toThrow(
        BadRequestException
      );
    });

    it('throws BadRequestException when page is a non-numeric string', async () => {
      const qb = createPaginationQb();
      await expect(applyPagination(qb, { page: 'abc' })).rejects.toThrow(
        BadRequestException
      );
    });

    it('error message mentions "page" for invalid page param', async () => {
      const qb = createPaginationQb();
      await expect(applyPagination(qb, { page: '0' })).rejects.toThrow(/page/);
    });

    it('error message mentions "perPage" for invalid perPage param', async () => {
      const qb = createPaginationQb();
      await expect(applyPagination(qb, { perPage: '0' })).rejects.toThrow(
        /perPage/
      );
    });
  });
});
