import { BadRequestException } from '@nestjs/common';
import { applyFields } from '@src/domain/handlers/fields.handler';
import { createMockQb } from '../utils/mock-query-builder';

const ALLOWED_FIELDS = ['id', 'name', 'cnpj', 'created_at'];
const ALLOWED_INCLUDES = ['user'];

describe('applyFields', () => {
  describe('absent / empty input', () => {
    it('does not call select when fields is undefined', () => {
      const qb = createMockQb();
      applyFields(qb as any, {}, 'root', ALLOWED_FIELDS);
      expect(qb.select).not.toHaveBeenCalled();
    });

    it('does not call select when fields is an empty string', () => {
      const qb = createMockQb();
      applyFields(qb as any, { fields: '' }, 'root', ALLOWED_FIELDS);
      expect(qb.select).not.toHaveBeenCalled();
    });

    it('does not call select when fields is not a string', () => {
      const qb = createMockQb();
      applyFields(qb as any, { fields: 42 as any }, 'root', ALLOWED_FIELDS);
      expect(qb.select).not.toHaveBeenCalled();
    });
  });

  describe('basic field selection', () => {
    it('calls select with an array of prefixed fields', () => {
      const qb = createMockQb();
      applyFields(qb as any, { fields: 'name,cnpj' }, 'root', ALLOWED_FIELDS);
      const [selected] = (qb.select as jest.Mock).mock.calls[0];
      expect(selected).toContain('root.name');
      expect(selected).toContain('root.cnpj');
    });

    it('passes an array (not a string) to qb.select', () => {
      const qb = createMockQb();
      applyFields(qb as any, { fields: 'name' }, 'root', ALLOWED_FIELDS);
      const [selected] = (qb.select as jest.Mock).mock.calls[0];
      expect(Array.isArray(selected)).toBe(true);
    });
  });

  describe('PK auto-prepend', () => {
    it('always includes root.id even when not requested', () => {
      const qb = createMockQb();
      applyFields(qb as any, { fields: 'name,cnpj' }, 'root', ALLOWED_FIELDS);
      const [selected] = (qb.select as jest.Mock).mock.calls[0];
      expect(selected).toContain('root.id');
    });

    it('does not duplicate root.id when id is explicitly requested', () => {
      const qb = createMockQb();
      applyFields(qb as any, { fields: 'id,name' }, 'root', ALLOWED_FIELDS);
      const [selected] = (qb.select as jest.Mock).mock.calls[0];
      const idOccurrences = selected.filter((f: string) => f === 'root.id');
      expect(idOccurrences).toHaveLength(1);
    });

    it('uses the custom alias for the PK', () => {
      const qb = createMockQb();
      applyFields(qb as any, { fields: 'name' }, 'company', ALLOWED_FIELDS);
      const [selected] = (qb.select as jest.Mock).mock.calls[0];
      expect(selected).toContain('company.id');
      expect(selected).not.toContain('root.id');
    });
  });

  describe('deduplication', () => {
    it('removes duplicate fields from the selection', () => {
      const qb = createMockQb();
      applyFields(qb as any, { fields: 'name,name,cnpj' }, 'root', ALLOWED_FIELDS);
      const [selected] = (qb.select as jest.Mock).mock.calls[0];
      const nameOccurrences = selected.filter((f: string) => f === 'root.name');
      expect(nameOccurrences).toHaveLength(1);
    });
  });

  describe('relation field classification', () => {
    it('does not prefix a field that is in allowedIncludes', () => {
      const qb = createMockQb();
      applyFields(
        qb as any,
        { fields: 'user' },
        'root',
        [...ALLOWED_FIELDS, 'user'],
        ALLOWED_INCLUDES
      );
      const [selected] = (qb.select as jest.Mock).mock.calls[0];
      expect(selected).toContain('user');
      expect(selected).not.toContain('root.user');
    });

    it('prefixes a non-relation field with the root alias', () => {
      const qb = createMockQb();
      applyFields(qb as any, { fields: 'name' }, 'root', ALLOWED_FIELDS, ALLOWED_INCLUDES);
      const [selected] = (qb.select as jest.Mock).mock.calls[0];
      expect(selected).toContain('root.name');
    });

    it('does not re-prefix a field that already contains a dot', () => {
      const qb = createMockQb();
      applyFields(
        qb as any,
        { fields: 'user.name' },
        'root',
        [...ALLOWED_FIELDS, 'user'],
        ALLOWED_INCLUDES
      );
      const [selected] = (qb.select as jest.Mock).mock.calls[0];
      expect(selected).toContain('user.name');
      expect(selected).not.toContain('root.user.name');
    });
  });

  describe('allowedIncludes absent', () => {
    it('prefixes all fields when allowedIncludes is undefined', () => {
      const qb = createMockQb();
      applyFields(qb as any, { fields: 'name' }, 'root', ALLOWED_FIELDS, undefined);
      const [selected] = (qb.select as jest.Mock).mock.calls[0];
      expect(selected).toContain('root.name');
    });
  });

  describe('allowed fields validation', () => {
    it('throws BadRequestException for a field not in allowedFields', () => {
      const qb = createMockQb();
      expect(() =>
        applyFields(qb as any, { fields: 'password' }, 'root', ALLOWED_FIELDS)
      ).toThrow(BadRequestException);
    });

    it('includes the invalid field name in the error message', () => {
      const qb = createMockQb();
      expect(() =>
        applyFields(qb as any, { fields: 'password' }, 'root', ALLOWED_FIELDS)
      ).toThrow(/password/);
    });
  });

  describe('safe path validation', () => {
    it('throws BadRequestException for a field with SQL injection characters', () => {
      const qb = createMockQb();
      expect(() =>
        applyFields(qb as any, { fields: 'name; DROP TABLE' }, 'root', ALLOWED_FIELDS)
      ).toThrow(BadRequestException);
    });
  });
});
