import { BadRequestException } from '@nestjs/common';
import { applySorts } from '@src/domain/handlers/sorts.handler';
import { createMockQb } from '../utils/mock-query-builder';

const ALLOWED_SORTS = ['name', 'cnpj', 'created_at', 'user.name'];

describe('applySorts', () => {
  describe('absent / empty input', () => {
    it('does nothing when sort is undefined', () => {
      const qb = createMockQb();
      applySorts(qb as any, {}, 'root', ALLOWED_SORTS);
      expect(qb.addOrderBy).not.toHaveBeenCalled();
    });

    it('does nothing when sort is an empty string', () => {
      const qb = createMockQb();
      applySorts(qb as any, { sort: '' }, 'root', ALLOWED_SORTS);
      expect(qb.addOrderBy).not.toHaveBeenCalled();
    });

    it('does nothing when sort is not a string', () => {
      const qb = createMockQb();
      applySorts(qb as any, { sort: 42 as any }, 'root', ALLOWED_SORTS);
      expect(qb.addOrderBy).not.toHaveBeenCalled();
    });
  });

  describe('ascending sort', () => {
    it('applies ASC for a plain field name', () => {
      const qb = createMockQb();
      applySorts(qb as any, { sort: 'name' }, 'root', ALLOWED_SORTS);
      expect(qb.addOrderBy).toHaveBeenCalledWith('root.name', 'ASC');
    });

    it('prefixes field with the root alias', () => {
      const qb = createMockQb();
      applySorts(qb as any, { sort: 'cnpj' }, 'company', ALLOWED_SORTS);
      expect(qb.addOrderBy).toHaveBeenCalledWith('company.cnpj', 'ASC');
    });
  });

  describe('descending sort (- prefix)', () => {
    it('applies DESC for a field prefixed with -', () => {
      const qb = createMockQb();
      applySorts(qb as any, { sort: '-name' }, 'root', ALLOWED_SORTS);
      expect(qb.addOrderBy).toHaveBeenCalledWith('root.name', 'DESC');
    });

    it('applies DESC for created_at with - prefix', () => {
      const qb = createMockQb();
      applySorts(qb as any, { sort: '-created_at' }, 'root', ALLOWED_SORTS);
      expect(qb.addOrderBy).toHaveBeenCalledWith('root.created_at', 'DESC');
    });
  });

  describe('multiple sorts (CSV)', () => {
    it('applies two sorts in input order', () => {
      const qb = createMockQb();
      applySorts(
        qb as any,
        { sort: 'name,-created_at' },
        'root',
        ALLOWED_SORTS
      );
      expect(qb.addOrderBy).toHaveBeenNthCalledWith(1, 'root.name', 'ASC');
      expect(qb.addOrderBy).toHaveBeenNthCalledWith(
        2,
        'root.created_at',
        'DESC'
      );
    });

    it('calls addOrderBy once per unique field', () => {
      const qb = createMockQb();
      applySorts(
        qb as any,
        { sort: 'name,cnpj,created_at' },
        'root',
        ALLOWED_SORTS
      );
      expect(qb.addOrderBy).toHaveBeenCalledTimes(3);
    });
  });

  describe('dot notation (relation fields)', () => {
    it('does not prefix relation fields with the root alias', () => {
      const qb = createMockQb();
      applySorts(qb as any, { sort: 'user.name' }, 'root', ALLOWED_SORTS);
      expect(qb.addOrderBy).toHaveBeenCalledWith('user.name', 'ASC');
    });

    it('applies DESC for a relation field', () => {
      const qb = createMockQb();
      applySorts(qb as any, { sort: '-user.name' }, 'root', ALLOWED_SORTS);
      expect(qb.addOrderBy).toHaveBeenCalledWith('user.name', 'DESC');
    });
  });

  describe('deduplication', () => {
    it('applies only one order when the same field appears twice', () => {
      const qb = createMockQb();
      applySorts(qb as any, { sort: 'name,name' }, 'root', ALLOWED_SORTS);
      expect(qb.addOrderBy).toHaveBeenCalledTimes(1);
    });

    it('last direction wins when the same field appears with different directions', () => {
      const qb = createMockQb();
      applySorts(qb as any, { sort: 'name,-name' }, 'root', ALLOWED_SORTS);
      expect(qb.addOrderBy).toHaveBeenCalledTimes(1);
      expect(qb.addOrderBy).toHaveBeenCalledWith('root.name', 'DESC');
    });
  });

  describe('allowed fields validation', () => {
    it('throws BadRequestException for a field not in allowedSorts', () => {
      const qb = createMockQb();
      expect(() =>
        applySorts(qb as any, { sort: 'password' }, 'root', ALLOWED_SORTS)
      ).toThrow(BadRequestException);
    });

    it('includes the invalid field name in the error message', () => {
      const qb = createMockQb();
      expect(() =>
        applySorts(qb as any, { sort: 'password' }, 'root', ALLOWED_SORTS)
      ).toThrow(/password/);
    });

    it('lists all allowed sorts in the error message', () => {
      const qb = createMockQb();
      expect(() =>
        applySorts(qb as any, { sort: 'password' }, 'root', ALLOWED_SORTS)
      ).toThrow(/name/);
    });

    it('throws listing all invalid fields when multiple are disallowed', () => {
      const qb = createMockQb();
      expect(() =>
        applySorts(
          qb as any,
          { sort: 'password,secret' },
          'root',
          ALLOWED_SORTS
        )
      ).toThrow(BadRequestException);
    });
  });

  describe('safe path validation', () => {
    it('throws BadRequestException for a field with SQL injection characters', () => {
      const qb = createMockQb();
      expect(() =>
        applySorts(
          qb as any,
          { sort: 'name; DROP TABLE' },
          'root',
          ALLOWED_SORTS
        )
      ).toThrow(BadRequestException);
    });

    it('throws for a field starting with a number', () => {
      const qb = createMockQb();
      expect(() =>
        applySorts(qb as any, { sort: '1invalid' }, 'root', ALLOWED_SORTS)
      ).toThrow(BadRequestException);
    });
  });

  describe('fieldsRule consistency', () => {
    it('allows sorting by a field present in fieldsRule', () => {
      const qb = createMockQb();
      expect(() =>
        applySorts(qb as any, { sort: 'name' }, 'root', ALLOWED_SORTS, [
          'id',
          'name',
        ])
      ).not.toThrow();
    });

    it('throws when sorting by a field absent from fieldsRule', () => {
      const qb = createMockQb();
      expect(() =>
        applySorts(qb as any, { sort: 'created_at' }, 'root', ALLOWED_SORTS, [
          'id',
          'name',
        ])
      ).toThrow(BadRequestException);
    });

    it('throws with a message mentioning the missing field', () => {
      const qb = createMockQb();
      expect(() =>
        applySorts(qb as any, { sort: 'created_at' }, 'root', ALLOWED_SORTS, [
          'id',
          'name',
        ])
      ).toThrow(/created_at/);
    });

    it('skips fieldsRule validation when fieldsRule is undefined', () => {
      const qb = createMockQb();
      expect(() =>
        applySorts(
          qb as any,
          { sort: 'name' },
          'root',
          ALLOWED_SORTS,
          undefined
        )
      ).not.toThrow();
    });

    it('skips fieldsRule validation when fieldsRule is empty', () => {
      const qb = createMockQb();
      expect(() =>
        applySorts(qb as any, { sort: 'name' }, 'root', ALLOWED_SORTS, [])
      ).not.toThrow();
    });

    it('does not validate relation fields (dot notation) against fieldsRule', () => {
      const qb = createMockQb();
      expect(() =>
        applySorts(qb as any, { sort: 'user.name' }, 'root', ALLOWED_SORTS, [
          'id',
          'name',
        ])
      ).not.toThrow();
    });
  });

  describe('alias', () => {
    it('uses a custom alias to prefix fields', () => {
      const qb = createMockQb();
      applySorts(qb as any, { sort: 'name' }, 'c', ALLOWED_SORTS);
      expect(qb.addOrderBy).toHaveBeenCalledWith('c.name', 'ASC');
    });
  });
});
