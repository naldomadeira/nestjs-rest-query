import { BadRequestException } from '@nestjs/common';
import { applyIncludes } from '@src/domain/handlers/includes.handler';
import { createMockQb } from '../utils/mock-query-builder';

const ALLOWED_INCLUDES = ['user', 'address', 'user.role', 'user.address'];

describe('applyIncludes', () => {
  describe('absent / empty input', () => {
    it('does nothing when includes is undefined', () => {
      const qb = createMockQb();
      applyIncludes(qb as any, {}, 'root', ALLOWED_INCLUDES);
      expect(qb.leftJoinAndSelect).not.toHaveBeenCalled();
    });

    it('does nothing when includes is an empty string', () => {
      const qb = createMockQb();
      applyIncludes(qb as any, { includes: '' }, 'root', ALLOWED_INCLUDES);
      expect(qb.leftJoinAndSelect).not.toHaveBeenCalled();
    });

    it('does nothing when includes is not a string', () => {
      const qb = createMockQb();
      applyIncludes(qb as any, { includes: 42 as any }, 'root', ALLOWED_INCLUDES);
      expect(qb.leftJoinAndSelect).not.toHaveBeenCalled();
    });
  });

  describe('simple include', () => {
    it('applies a single leftJoinAndSelect with correct path and alias', () => {
      const qb = createMockQb();
      applyIncludes(qb as any, { includes: 'user' }, 'root', ALLOWED_INCLUDES);
      expect(qb.leftJoinAndSelect).toHaveBeenCalledTimes(1);
      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('root.user', 'user');
    });

    it('uses a custom root alias', () => {
      const qb = createMockQb();
      applyIncludes(qb as any, { includes: 'user' }, 'c', ALLOWED_INCLUDES);
      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('c.user', 'user');
    });
  });

  describe('multiple includes (CSV)', () => {
    it('applies one join per include', () => {
      const qb = createMockQb();
      applyIncludes(qb as any, { includes: 'user,address' }, 'root', ALLOWED_INCLUDES);
      expect(qb.leftJoinAndSelect).toHaveBeenCalledTimes(2);
      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('root.user', 'user');
      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('root.address', 'address');
    });
  });

  describe('nested includes (dot notation)', () => {
    it('applies parent join before child join', () => {
      const qb = createMockQb();
      applyIncludes(qb as any, { includes: 'user.role' }, 'root', ALLOWED_INCLUDES);
      expect(qb.leftJoinAndSelect).toHaveBeenCalledTimes(2);
      expect(qb.leftJoinAndSelect).toHaveBeenNthCalledWith(1, 'root.user', 'user');
      expect(qb.leftJoinAndSelect).toHaveBeenNthCalledWith(2, 'user.role', 'user_role');
    });

    it('uses underscore-joined parts as alias for nested relation', () => {
      const qb = createMockQb();
      applyIncludes(qb as any, { includes: 'user.address' }, 'root', ALLOWED_INCLUDES);
      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('user.address', 'user_address');
    });
  });

  describe('deduplication', () => {
    it('applies only one join when the same include appears twice', () => {
      const qb = createMockQb();
      applyIncludes(qb as any, { includes: 'user,user' }, 'root', ALLOWED_INCLUDES);
      expect(qb.leftJoinAndSelect).toHaveBeenCalledTimes(1);
    });

    it('applies the parent join only once when shared by multiple nested includes', () => {
      const qb = createMockQb();
      applyIncludes(
        qb as any,
        { includes: 'user.role,user.address' },
        'root',
        ALLOWED_INCLUDES
      );
      // root.user once, user.role once, user.address once — total 3
      expect(qb.leftJoinAndSelect).toHaveBeenCalledTimes(3);
      const calls = (qb.leftJoinAndSelect as jest.Mock).mock.calls;
      const rootUserCalls = calls.filter(([path]: [string]) => path === 'root.user');
      expect(rootUserCalls).toHaveLength(1);
    });
  });

  describe('allowed includes validation', () => {
    it('throws BadRequestException for an include not in allowedIncludes', () => {
      const qb = createMockQb();
      expect(() =>
        applyIncludes(qb as any, { includes: 'secrets' }, 'root', ALLOWED_INCLUDES)
      ).toThrow(BadRequestException);
    });

    it('includes the invalid relation name in the error message', () => {
      const qb = createMockQb();
      expect(() =>
        applyIncludes(qb as any, { includes: 'secrets' }, 'root', ALLOWED_INCLUDES)
      ).toThrow(/secrets/);
    });

    it('lists allowed includes in the error message', () => {
      const qb = createMockQb();
      expect(() =>
        applyIncludes(qb as any, { includes: 'secrets' }, 'root', ALLOWED_INCLUDES)
      ).toThrow(/user/);
    });
  });

  describe('safe path validation', () => {
    it('throws BadRequestException for an include with SQL injection characters', () => {
      const qb = createMockQb();
      expect(() =>
        applyIncludes(qb as any, { includes: 'user; DROP TABLE' }, 'root', ALLOWED_INCLUDES)
      ).toThrow(BadRequestException);
    });

    it('throws for a path starting with a number', () => {
      const qb = createMockQb();
      expect(() =>
        applyIncludes(qb as any, { includes: '1invalid' }, 'root', ALLOWED_INCLUDES)
      ).toThrow(BadRequestException);
    });
  });
});
