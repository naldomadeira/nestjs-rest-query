import {
  dqbSwaggerRequestInterceptor,
  DQB_SWAGGER_EXTENSION_KEY,
} from '@src/api/swagger/swagger.interceptor';

describe('dqbSwaggerRequestInterceptor', () => {
  const document = {
    openapi: '3.0.0',
    paths: {
      '/users': {
        get: {
          [DQB_SWAGGER_EXTENSION_KEY]: true,
        },
      },
      '/health': {
        get: {},
      },
      '/users/{id}/posts': {
        get: {
          [DQB_SWAGGER_EXTENSION_KEY]: true,
        },
      },
    },
  };

  it('intercepts only GET routes marked by the library in the OpenAPI document', () => {
    const interceptor = dqbSwaggerRequestInterceptor(document);
    const req = {
      method: 'GET',
      url: '/users?filter=%5Bname%5D%5Beq%5D%3Djohn&page=1',
    };

    const result = interceptor(req);

    expect(result.url).toBe('/users?filter%5Bname%5D%5Beq%5D=john&page=1');
  });

  it('does not rewrite GET routes that are not marked by the library', () => {
    const interceptor = dqbSwaggerRequestInterceptor(document);
    const req = {
      method: 'GET',
      url: '/health?filter=%5Bname%5D%5Beq%5D%3Djohn',
    };

    const result = interceptor(req);

    expect(result.url).toBe('/health?filter=%5Bname%5D%5Beq%5D%3Djohn');
  });

  it('does not rewrite non-GET requests even for library routes', () => {
    const interceptor = dqbSwaggerRequestInterceptor(document);
    const req = {
      method: 'POST',
      url: '/users?filter=%5Bname%5D%5Beq%5D%3Djohn',
    };

    const result = interceptor(req);

    expect(result.url).toBe('/users?filter=%5Bname%5D%5Beq%5D%3Djohn');
  });

  it('supports OpenAPI paths with params when matching library routes', () => {
    const interceptor = dqbSwaggerRequestInterceptor(document);
    const req = {
      method: 'GET',
      url: '/users/42/posts?filter=%5Btitle%5D%5Blike%5D%3Dhello',
    };

    const result = interceptor(req);

    expect(result.url).toBe(
      '/users/42/posts?filter%5Btitle%5D%5Blike%5D=hello'
    );
  });

  it('preserves the absolute URL when Swagger sends a full request URL', () => {
    const interceptor = dqbSwaggerRequestInterceptor(document);
    const req = {
      method: 'GET',
      url: 'http://localhost:3011/users?filter=%5Busername%5D%5Beq%5D%3Dadmin.system',
    };

    const result = interceptor(req);

    expect(result.url).toBe(
      'http://localhost:3011/users?filter%5Busername%5D%5Beq%5D=admin.system'
    );
  });
});
