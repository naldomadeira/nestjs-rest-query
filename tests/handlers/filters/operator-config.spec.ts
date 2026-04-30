import { BadRequestException } from '@nestjs/common';
import { applyFilters } from '@src/domain/handlers/filters.handler';
import { createMockQb } from '../../utils/mock-query-builder';

const ALLOWED = ['name', 'cnpj', 'status', 'user.role'];

/**
 * Operadores inválidos, whitelist de operadores via config
 * e comportamento do in/notIn com array vazio.
 */
describe('applyFilters — operator config & edge cases', () => {
  describe('unsupported operator', () => {
    it('throws BadRequestException for an unknown operator', () => {
      const qb = createMockQb();
      expect(() =>
        applyFilters(
          qb as any,
          { filter: { name: { unknownOp: 'x' } } },
          'root',
          ALLOWED
        )
      ).toThrow(BadRequestException);
    });

    it('error message contains "Unsupported operator"', () => {
      const qb = createMockQb();
      expect(() =>
        applyFilters(
          qb as any,
          { filter: { name: { unknownOp: 'x' } } },
          'root',
          ALLOWED
        )
      ).toThrow(/Unsupported operator/);
    });

    it('error message lists supported operators', () => {
      const qb = createMockQb();
      expect(() =>
        applyFilters(
          qb as any,
          { filter: { name: { unknownOp: 'x' } } },
          'root',
          ALLOWED
        )
      ).toThrow(/eq/);
    });
  });

  describe('operatorsConfig whitelist', () => {
    it('throws when using an operator outside the allowed list', () => {
      const qb = createMockQb();
      expect(() =>
        applyFilters(
          qb as any,
          { filter: { name: { ilike: 'x' } } },
          'root',
          ALLOWED,
          { allowed: ['eq', 'like'] }
        )
      ).toThrow(BadRequestException);
    });

    it('error message contains "not allowed" when operator is outside whitelist', () => {
      const qb = createMockQb();
      expect(() =>
        applyFilters(
          qb as any,
          { filter: { name: { ilike: 'x' } } },
          'root',
          ALLOWED,
          { allowed: ['eq', 'like'] }
        )
      ).toThrow(/not allowed/);
    });

    it('does not throw when using an operator inside the allowed list', () => {
      const qb = createMockQb();
      expect(() =>
        applyFilters(
          qb as any,
          { filter: { name: { eq: 'x' } } },
          'root',
          ALLOWED,
          { allowed: ['eq'] }
        )
      ).not.toThrow();
    });

    it('allows all operators when operatorsConfig is undefined', () => {
      const qb = createMockQb();
      expect(() =>
        applyFilters(
          qb as any,
          { filter: { name: { ilike: 'x' } } },
          'root',
          ALLOWED,
          undefined
        )
      ).not.toThrow();
    });

    it('blocks all operators when allowed list is empty (empty whitelist = nothing permitted)', () => {
      const qb = createMockQb();
      expect(() =>
        applyFilters(
          qb as any,
          { filter: { name: { eq: 'x' } } },
          'root',
          ALLOWED,
          { allowed: [] }
        )
      ).toThrow(BadRequestException);
    });

    it('distinguishes undefined (no restriction) from [] (block all)', () => {
      const qb = createMockQb();
      // undefined → no restriction
      expect(() =>
        applyFilters(
          qb as any,
          { filter: { name: { ilike: 'x' } } },
          'root',
          ALLOWED,
          undefined
        )
      ).not.toThrow();
      // [] → block all
      expect(() =>
        applyFilters(
          qb as any,
          { filter: { name: { ilike: 'x' } } },
          'root',
          ALLOWED,
          { allowed: [] }
        )
      ).toThrow(BadRequestException);
    });

    it('error message lists the allowed operators', () => {
      const qb = createMockQb();
      expect(() =>
        applyFilters(
          qb as any,
          { filter: { name: { ilike: 'x' } } },
          'root',
          ALLOWED,
          { allowed: ['eq', 'like'] }
        )
      ).toThrow(/eq/);
    });
  });

  describe('in / notIn with empty array after coerce', () => {
    it('does not call andWhere when in value coerces to an empty array', () => {
      const qb = createMockQb();
      applyFilters(
        qb as any,
        { filter: { status: { in: '' } } },
        'root',
        ALLOWED
      );
      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it('does not call andWhere when notIn value coerces to an empty array', () => {
      const qb = createMockQb();
      applyFilters(
        qb as any,
        { filter: { status: { notIn: '' } } },
        'root',
        ALLOWED
      );
      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it('still applies andWhere for in when array has values', () => {
      const qb = createMockQb();
      applyFilters(
        qb as any,
        { filter: { status: { in: '1,2' } } },
        'root',
        ALLOWED
      );
      expect(qb.andWhere).toHaveBeenCalledTimes(1);
    });
  });
});
