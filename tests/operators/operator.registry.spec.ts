import { operatorRegistry } from '@src/domain/operators/operator.registry';
import { ALL_OPERATORS, Operator } from '@src/domain/operators/operator.types';
import { createMockQb } from '../utils/mock-query-builder';

describe('operatorRegistry', () => {
  describe('completeness', () => {
    it('contains exactly the same operators defined in ALL_OPERATORS', () => {
      const registryKeys = Object.keys(operatorRegistry).sort();
      const allOps = [...ALL_OPERATORS].sort();
      expect(registryKeys).toEqual(allOps);
    });

    it('has a handler for every Operator enum value', () => {
      for (const op of Object.values(Operator)) {
        expect(operatorRegistry[op]).toBeDefined();
        expect(typeof operatorRegistry[op]).toBe('function');
      }
    });
  });

  describe('eq', () => {
    it('generates an equality condition', () => {
      const qb = createMockQb();
      operatorRegistry.eq(qb as any, 'root', 'name', 'filter_0', 'Acme');
      expect(qb.andWhere).toHaveBeenCalledWith('root.name = :filter_0', {
        filter_0: 'Acme',
      });
    });

    it('works with a numeric value', () => {
      const qb = createMockQb();
      operatorRegistry.eq(qb as any, 'root', 'id', 'filter_0', 42);
      expect(qb.andWhere).toHaveBeenCalledWith('root.id = :filter_0', {
        filter_0: 42,
      });
    });
  });

  describe('ne', () => {
    it('generates a not-equal condition', () => {
      const qb = createMockQb();
      operatorRegistry.ne(qb as any, 'root', 'status', 'filter_0', 'inactive');
      expect(qb.andWhere).toHaveBeenCalledWith('root.status != :filter_0', {
        filter_0: 'inactive',
      });
    });
  });

  describe('like', () => {
    it('wraps the value with wildcards on both sides', () => {
      const qb = createMockQb();
      operatorRegistry.like(qb as any, 'root', 'name', 'filter_0', 'Ac');
      expect(qb.andWhere).toHaveBeenCalledWith('root.name LIKE :filter_0', {
        filter_0: '%Ac%',
      });
    });

    it('applies the wildcard in the handler, not expecting it from the caller', () => {
      const qb = createMockQb();
      operatorRegistry.like(qb as any, 'root', 'name', 'filter_0', 'term');
      const [, params] = (qb.andWhere as jest.Mock).mock.calls[0];
      expect(params.filter_0).toBe('%term%');
    });
  });

  describe('ilike', () => {
    it('generates a case-insensitive LIKE using LOWER()', () => {
      const qb = createMockQb();
      operatorRegistry.ilike(qb as any, 'root', 'name', 'filter_0', 'laptop');
      expect(qb.andWhere).toHaveBeenCalledWith(
        'LOWER(root.name) LIKE LOWER(:filter_0)',
        { filter_0: '%laptop%' }
      );
    });
  });

  describe('notLike', () => {
    it('generates a NOT LIKE condition with wildcards', () => {
      const qb = createMockQb();
      operatorRegistry.notLike(qb as any, 'root', 'name', 'filter_0', 'test');
      expect(qb.andWhere).toHaveBeenCalledWith('root.name NOT LIKE :filter_0', {
        filter_0: '%test%',
      });
    });
  });

  describe('notIlike', () => {
    it('generates a case-insensitive NOT LIKE using LOWER()', () => {
      const qb = createMockQb();
      operatorRegistry.notIlike(qb as any, 'root', 'name', 'filter_0', 'test');
      expect(qb.andWhere).toHaveBeenCalledWith(
        'LOWER(root.name) NOT LIKE LOWER(:filter_0)',
        { filter_0: '%test%' }
      );
    });
  });

  describe('gt', () => {
    it('generates a greater-than condition', () => {
      const qb = createMockQb();
      operatorRegistry.gt(qb as any, 'root', 'price', 'filter_0', 100);
      expect(qb.andWhere).toHaveBeenCalledWith('root.price > :filter_0', {
        filter_0: 100,
      });
    });
  });

  describe('gte', () => {
    it('generates a greater-than-or-equal condition', () => {
      const qb = createMockQb();
      operatorRegistry.gte(qb as any, 'root', 'price', 'filter_0', 100);
      expect(qb.andWhere).toHaveBeenCalledWith('root.price >= :filter_0', {
        filter_0: 100,
      });
    });
  });

  describe('lt', () => {
    it('generates a less-than condition', () => {
      const qb = createMockQb();
      operatorRegistry.lt(qb as any, 'root', 'price', 'filter_0', 50);
      expect(qb.andWhere).toHaveBeenCalledWith('root.price < :filter_0', {
        filter_0: 50,
      });
    });
  });

  describe('lte', () => {
    it('generates a less-than-or-equal condition', () => {
      const qb = createMockQb();
      operatorRegistry.lte(qb as any, 'root', 'price', 'filter_0', 50);
      expect(qb.andWhere).toHaveBeenCalledWith('root.price <= :filter_0', {
        filter_0: 50,
      });
    });
  });

  describe('in', () => {
    it('generates an IN condition for an array', () => {
      const qb = createMockQb();
      operatorRegistry.in(qb as any, 'root', 'status', 'filter_0', [1, 2, 3]);
      expect(qb.andWhere).toHaveBeenCalledWith(
        'root.status IN (:...filter_0)',
        { filter_0: [1, 2, 3] }
      );
    });

    it('works with a single-item array (does not collapse to eq)', () => {
      const qb = createMockQb();
      operatorRegistry.in(qb as any, 'root', 'id', 'filter_0', [5]);
      expect(qb.andWhere).toHaveBeenCalledWith('root.id IN (:...filter_0)', {
        filter_0: [5],
      });
    });
  });

  describe('notIn', () => {
    it('generates a NOT IN condition', () => {
      const qb = createMockQb();
      operatorRegistry.notIn(qb as any, 'root', 'status', 'filter_0', [
        'a',
        'b',
      ]);
      expect(qb.andWhere).toHaveBeenCalledWith(
        'root.status NOT IN (:...filter_0)',
        { filter_0: ['a', 'b'] }
      );
    });
  });

  describe('between', () => {
    it('generates a BETWEEN condition with _start and _end param keys', () => {
      const qb = createMockQb();
      operatorRegistry.between(
        qb as any,
        'root',
        'price',
        'filter_0',
        [10, 50]
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'root.price BETWEEN :filter_0_start AND :filter_0_end',
        { filter_0_start: 10, filter_0_end: 50 }
      );
    });
  });

  describe('isNull', () => {
    it('generates IS NULL when value is true', () => {
      const qb = createMockQb();
      operatorRegistry.isNull(
        qb as any,
        'root',
        'deleted_at',
        'filter_0',
        true
      );
      expect(qb.andWhere).toHaveBeenCalledWith('root.deleted_at IS NULL');
    });

    it('generates IS NOT NULL when value is false', () => {
      const qb = createMockQb();
      operatorRegistry.isNull(
        qb as any,
        'root',
        'deleted_at',
        'filter_0',
        false
      );
      expect(qb.andWhere).toHaveBeenCalledWith('root.deleted_at IS NOT NULL');
    });

    it('does not pass a params object (IS NULL uses no bound parameter)', () => {
      const qb = createMockQb();
      operatorRegistry.isNull(
        qb as any,
        'root',
        'deleted_at',
        'filter_0',
        true
      );
      const call = (qb.andWhere as jest.Mock).mock.calls[0];
      expect(call).toHaveLength(1);
    });
  });

  describe('param key uniqueness across sequential calls', () => {
    it('uses distinct param keys for different calls without collisions', () => {
      const qb = createMockQb();
      operatorRegistry.eq(qb as any, 'root', 'name', 'filter_0', 'Acme');
      operatorRegistry.eq(qb as any, 'root', 'status', 'filter_1', 'active');
      operatorRegistry.eq(qb as any, 'root', 'id', 'filter_2', 1);

      expect(qb._andWhereCalls[0].params).toEqual({ filter_0: 'Acme' });
      expect(qb._andWhereCalls[1].params).toEqual({ filter_1: 'active' });
      expect(qb._andWhereCalls[2].params).toEqual({ filter_2: 1 });
    });
  });

  describe('alias with underscores (nested relation alias)', () => {
    it('handles aliases generated from nested paths (e.g. user_address)', () => {
      const qb = createMockQb();
      operatorRegistry.eq(
        qb as any,
        'user_address',
        'city',
        'filter_0',
        'São Paulo'
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'user_address.city = :filter_0',
        { filter_0: 'São Paulo' }
      );
    });
  });
});
