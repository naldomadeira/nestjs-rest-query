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
    afterEach(() => jest.dontMock('@nestjs/swagger'));

    it('returns the descriptor unchanged when swagger is not installed', () => {
      // Carrega o decorator num registro próprio em que `@nestjs/swagger` não
      // resolve — o caminho real de quem não instalou o peer opcional.
      jest.isolateModules(() => {
        jest.doMock('@nestjs/swagger', () => {
          throw new Error("Cannot find module '@nestjs/swagger'");
        });
        const isolated =
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require('@src/api/decorators/api-paginated-response.decorator') as typeof import('@src/api/decorators/api-paginated-response.decorator');

        const descriptor = { value: jest.fn() };
        const result = isolated.ApiPaginatedResponse(UserModel)(
          {},
          'method',
          descriptor
        );
        expect(result).toBe(descriptor);
      });
    });
  });
});
