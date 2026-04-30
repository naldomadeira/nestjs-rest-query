import { BadRequestException } from '@nestjs/common';
import { applyFilters } from '@src/domain/handlers/filters.handler';
import { createMockQb } from '../../utils/mock-query-builder';

const ALLOWED = ['name', 'cnpj', 'status'];
// 'user' → broad access: allows any user.* field
const ALLOWED_WITH_RELATION_ROOT = ['name', 'cnpj', 'status', 'user'];
// 'user.role' → granular access: allows only user.role
const ALLOWED_WITH_RELATION_FULL = ['name', 'cnpj', 'status', 'user.role'];

/**
 * Como os filtros são despachados para operadores,
 * incluindo shorthand escalar, sintaxe de objeto, dot notation e indexação de params.
 */
describe('applyFilters — filter dispatch', () => {
  describe('scalar shorthand (implicit eq)', () => {
    it('applies eq automatically for a string scalar', () => {
      const qb = createMockQb();
      applyFilters(qb as any, { filter: { name: 'Acme' } }, 'root', ALLOWED);
      expect(qb.andWhere).toHaveBeenCalledWith('root.name = :filter_0', {
        filter_0: 'Acme',
      });
    });

    it('applies eq automatically for a numeric scalar', () => {
      const qb = createMockQb();
      applyFilters(qb as any, { filter: { name: 42 } }, 'root', ALLOWED);
      expect(qb.andWhere).toHaveBeenCalledWith('root.name = :filter_0', {
        filter_0: 42,
      });
    });
  });

  describe('operator object syntax', () => {
    it('dispatches eq', () => {
      const qb = createMockQb();
      applyFilters(
        qb as any,
        { filter: { name: { eq: 'Acme' } } },
        'root',
        ALLOWED
      );
      expect(qb.andWhere).toHaveBeenCalledWith('root.name = :filter_0', {
        filter_0: 'Acme',
      });
    });

    it('dispatches like with wildcards', () => {
      const qb = createMockQb();
      applyFilters(
        qb as any,
        { filter: { name: { like: 'Ac' } } },
        'root',
        ALLOWED
      );
      expect(qb.andWhere).toHaveBeenCalledWith('root.name LIKE :filter_0', {
        filter_0: '%Ac%',
      });
    });

    it('dispatches ilike with LOWER()', () => {
      const qb = createMockQb();
      applyFilters(
        qb as any,
        { filter: { name: { ilike: 'ac' } } },
        'root',
        ALLOWED
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'LOWER(root.name) LIKE LOWER(:filter_0)',
        { filter_0: '%ac%' }
      );
    });

    it('dispatches in with CSV string coercion', () => {
      const qb = createMockQb();
      applyFilters(
        qb as any,
        { filter: { status: { in: '1,2,3' } } },
        'root',
        ALLOWED
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'root.status IN (:...filter_0)',
        {
          filter_0: [1, 2, 3],
        }
      );
    });

    it('dispatches gte', () => {
      const qb = createMockQb();
      applyFilters(
        qb as any,
        { filter: { name: { gte: 'b' } } },
        'root',
        ALLOWED
      );
      expect(qb.andWhere).toHaveBeenCalledWith('root.name >= :filter_0', {
        filter_0: 'b',
      });
    });

    it('applies two andWhere calls for two operators on the same field', () => {
      const qb = createMockQb();
      applyFilters(
        qb as any,
        { filter: { name: { gte: 'a', lte: 'z' } } },
        'root',
        ALLOWED
      );
      expect(qb.andWhere).toHaveBeenCalledTimes(2);
      expect(qb._andWhereCalls[0].condition).toContain('>=');
      expect(qb._andWhereCalls[1].condition).toContain('<=');
    });

    it('applies one call per field when multiple fields are filtered', () => {
      const qb = createMockQb();
      applyFilters(
        qb as any,
        { filter: { name: { eq: 'X' }, status: { eq: 1 } } },
        'root',
        ALLOWED
      );
      expect(qb.andWhere).toHaveBeenCalledTimes(2);
    });
  });

  describe('dot notation (relation fields)', () => {
    describe('broad access — root in allowedFilters (e.g. "user")', () => {
      it('allows any user.* field when root "user" is whitelisted', () => {
        const qb = createMockQb();
        applyFilters(
          qb as any,
          { filter: { 'user.role': { eq: 'admin' } } },
          'root',
          ALLOWED_WITH_RELATION_ROOT
        );
        expect(qb.andWhere).toHaveBeenCalledWith('user.role = :filter_0', {
          filter_0: 'admin',
        });
      });

      it('also allows user.email when root "user" is whitelisted', () => {
        const qb = createMockQb();
        expect(() =>
          applyFilters(
            qb as any,
            { filter: { 'user.email': { eq: 'x@x.com' } } },
            'root',
            ALLOWED_WITH_RELATION_ROOT
          )
        ).not.toThrow();
      });

      it('does not prefix the relation field with the root alias', () => {
        const qb = createMockQb();
        applyFilters(
          qb as any,
          { filter: { 'user.role': { eq: 'admin' } } },
          'root',
          ALLOWED_WITH_RELATION_ROOT
        );
        const [condition] = (qb.andWhere as jest.Mock).mock.calls[0];
        expect(condition).not.toContain('root.user');
      });
    });

    describe('granular access — full path in allowedFilters (e.g. "user.role")', () => {
      it('allows user.role when exactly "user.role" is whitelisted', () => {
        const qb = createMockQb();
        expect(() =>
          applyFilters(
            qb as any,
            { filter: { 'user.role': { eq: 'admin' } } },
            'root',
            ALLOWED_WITH_RELATION_FULL
          )
        ).not.toThrow();
      });

      it('rejects user.email when only "user.role" is whitelisted', () => {
        const qb = createMockQb();
        expect(() =>
          applyFilters(
            qb as any,
            { filter: { 'user.email': { eq: 'x@x.com' } } },
            'root',
            ALLOWED_WITH_RELATION_FULL
          )
        ).toThrow(BadRequestException);
      });

      it('generates the correct condition for user.role', () => {
        const qb = createMockQb();
        applyFilters(
          qb as any,
          { filter: { 'user.role': { eq: 'admin' } } },
          'root',
          ALLOWED_WITH_RELATION_FULL
        );
        expect(qb.andWhere).toHaveBeenCalledWith('user.role = :filter_0', {
          filter_0: 'admin',
        });
      });
    });

    describe('combining root and relation fields', () => {
      it('applies conditions for both a root field and a relation field', () => {
        const qb = createMockQb();
        applyFilters(
          qb as any,
          { filter: { name: { eq: 'Acme' }, 'user.role': { eq: 'admin' } } },
          'root',
          ALLOWED_WITH_RELATION_ROOT
        );
        expect(qb.andWhere).toHaveBeenCalledTimes(2);
        const conditions = qb._andWhereCalls.map((c) => c.condition);
        expect(conditions.some((c) => c.includes('root.name'))).toBe(true);
        expect(conditions.some((c) => c.includes('user.role'))).toBe(true);
      });
    });
  });

  describe('param key indexing', () => {
    it('uses filter_0 and filter_1 for two separate filters', () => {
      const qb = createMockQb();
      applyFilters(
        qb as any,
        { filter: { name: { eq: 'Acme' }, cnpj: { eq: '12345' } } },
        'root',
        ALLOWED
      );
      expect(qb._andWhereCalls[0].params).toHaveProperty('filter_0');
      expect(qb._andWhereCalls[1].params).toHaveProperty('filter_1');
    });

    it('uses filter_0, filter_1, filter_2 for three filters without collisions', () => {
      const qb = createMockQb();
      applyFilters(
        qb as any,
        {
          filter: { name: { eq: 'A' }, cnpj: { eq: 'B' }, status: { eq: 'C' } },
        },
        'root',
        ALLOWED
      );
      expect(qb._andWhereCalls[0].params).toHaveProperty('filter_0');
      expect(qb._andWhereCalls[1].params).toHaveProperty('filter_1');
      expect(qb._andWhereCalls[2].params).toHaveProperty('filter_2');
    });

    it('increments index across operators of the same field', () => {
      const qb = createMockQb();
      applyFilters(
        qb as any,
        { filter: { name: { gte: 'a', lte: 'z' } } },
        'root',
        ALLOWED
      );
      expect(qb._andWhereCalls[0].params).toHaveProperty('filter_0');
      expect(qb._andWhereCalls[1].params).toHaveProperty('filter_1');
    });
  });
});
