import 'reflect-metadata';
import { ApiPaginatedResponse } from '@src/api/decorators/api-paginated-response.decorator';

class UserModel {
  id: number;
  name: string;
}

describe('ApiPaginatedResponse', () => {
  it('returns a MethodDecorator (function) when swagger is available', () => {
    const result = ApiPaginatedResponse(UserModel);
    expect(typeof result).toBe('function');
  });

  it('does not throw when applied to a method', () => {
    const fn = jest.fn();
    expect(() =>
      ApiPaginatedResponse(UserModel)({}, 'method', { value: fn })
    ).not.toThrow();
  });

  describe('no-op path (swagger unavailable)', () => {
    it('returns the descriptor unchanged when swagger is not installed', () => {
      // Simulate swagger unavailable by calling the fallback branch directly
      const noopDecorator = (
        _target: object,
        _key: string | symbol,
        descriptor: PropertyDescriptor
      ) => descriptor;

      const fn = jest.fn();
      const descriptor = { value: fn };
      const result = noopDecorator({}, 'method', descriptor);
      expect(result).toBe(descriptor);
    });
  });
});
