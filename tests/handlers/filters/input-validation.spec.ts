import { BadRequestException } from '@nestjs/common';
import { applyFilters } from '@src/domain/handlers/filters.handler';
import { createMockQb } from '../../utils/mock-query-builder';

const ALLOWED = ['name', 'cnpj', 'status', 'user.role'];

/**
 * Input ausente, tipo errado e formatos de valor inválidos.
 */
describe('applyFilters — input validation', () => {
  describe('absent / empty filter', () => {
    it('does nothing when filter is undefined', () => {
      const qb = createMockQb();
      applyFilters(qb as any, {}, 'root', ALLOWED);
      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it('does nothing when filter is null', () => {
      const qb = createMockQb();
      applyFilters(qb as any, { filter: null as any }, 'root', ALLOWED);
      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it('does nothing when filter is an empty object', () => {
      const qb = createMockQb();
      applyFilters(qb as any, { filter: {} }, 'root', ALLOWED);
      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it('does nothing when filter is a string (wrong type)', () => {
      const qb = createMockQb();
      applyFilters(qb as any, { filter: 'invalid' as any }, 'root', ALLOWED);
      expect(qb.andWhere).not.toHaveBeenCalled();
    });
  });

  describe('invalid field value format', () => {
    it('throws BadRequestException when field value is a boolean', () => {
      const qb = createMockQb();
      expect(() =>
        applyFilters(
          qb as any,
          { filter: { name: true as any } },
          'root',
          ALLOWED
        )
      ).toThrow(BadRequestException);
    });

    it('error message mentions "Invalid filter format" for boolean value', () => {
      const qb = createMockQb();
      expect(() =>
        applyFilters(
          qb as any,
          { filter: { name: true as any } },
          'root',
          ALLOWED
        )
      ).toThrow(/Invalid filter format/);
    });

    it('does not throw and does not call andWhere when field value is an empty array', () => {
      // An empty array is typeof 'object', so it enters the object branch.
      // Object.entries([]) yields no entries → silently skipped, same behaviour as {}.
      const qb = createMockQb();
      expect(() =>
        applyFilters(
          qb as any,
          { filter: { name: [] as any } },
          'root',
          ALLOWED
        )
      ).not.toThrow();
      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it('does not call andWhere before throwing on invalid format', () => {
      const qb = createMockQb();
      try {
        applyFilters(
          qb as any,
          { filter: { name: true as any } },
          'root',
          ALLOWED
        );
      } catch {}
      expect(qb.andWhere).not.toHaveBeenCalled();
    });
  });
});
