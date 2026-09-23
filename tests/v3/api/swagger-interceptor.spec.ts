import { runInNewContext } from 'node:vm';
// O serializador real do `@nestjs/swagger`: é ele que grava as
// `swaggerOptions` no `swagger-ui-init.js` que o browser executa.
import { buildJSInitOptions } from '@nestjs/swagger/dist/swagger-ui/helpers';
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

/**
 * Bug #3 do relato de consumidor externo: o `@nestjs/swagger` serializa o
 * `requestInterceptor` com `toString()` para dentro do `swagger-ui-init.js`, e
 * a função devolvida pela lib era uma closure sobre helpers do módulo. No
 * browser eles não existem: todo "Try it out" falhava com
 * `ReferenceError: interceptSwaggerRequest is not defined`.
 *
 * Os testes acima chamam a função no mesmo processo, com a closure viva, e por
 * isso nunca viram o defeito. Estes avaliam o texto serializado num contexto
 * `vm` novo — sem módulo, sem `require`, sem nada deste arquivo —, que é o que
 * o browser recebe.
 */
describe('regression: swagger request interceptor self-contained (consumer report #3)', () => {
  const document = {
    paths: {
      '/users': { get: { [DQB_SWAGGER_EXTENSION_KEY]: true } },
      '/users/{id}/posts': { get: { [DQB_SWAGGER_EXTENSION_KEY]: true } },
      '/health': { get: {} },
    },
  };

  type Interceptor = (req: { url?: string; method?: string }) => {
    url?: string;
  };

  /**
   * Serializa como o `@nestjs/swagger` e executa como o browser.
   *
   * `SwaggerModule.setup(path, app, document, { swaggerOptions })` chega a
   * `buildJSInitOptions` com as opções do consumidor em `customOptions` — a
   * mesma forma montada por `buildSwaggerInitJS`.
   */
  function inBrowser(requestInterceptor: unknown): Interceptor {
    const script = buildJSInitOptions({
      swaggerDoc: document as never,
      swaggerUrl: undefined as never,
      customOptions: { requestInterceptor } as never,
    });
    const sandbox: Record<string, unknown> = { console };
    runInNewContext(`${script}\nthis.options = options;`, sandbox);
    return (
      sandbox.options as { customOptions: { requestInterceptor: Interceptor } }
    ).customOptions.requestInterceptor;
  }

  it('a forma com documento roda sem a closure', () => {
    const interceptor = inBrowser(dqbSwaggerRequestInterceptor(document));

    expect(
      interceptor({
        method: 'GET',
        url: '/users?filter=%5Bname%5D%5Beq%5D%3Djohn&page=1',
      }).url
    ).toBe('/users?filter%5Bname%5D%5Beq%5D=john&page=1');
    expect(
      interceptor({
        method: 'GET',
        url: '/users/42/posts?filter=%5Btitle%5D%5Blike%5D%3Dhello',
      }).url
    ).toBe('/users/42/posts?filter%5Btitle%5D%5Blike%5D=hello');
  });

  it('as rotas não marcadas continuam intactas no browser', () => {
    const interceptor = inBrowser(dqbSwaggerRequestInterceptor(document));
    const url = '/health?filter=%5Bname%5D%5Beq%5D%3Djohn';

    expect(interceptor({ method: 'GET', url }).url).toBe(url);
  });

  it('a forma direta (sem documento) também roda sem o módulo', () => {
    const interceptor = inBrowser(dqbSwaggerRequestInterceptor);

    expect(
      interceptor({
        method: 'GET',
        url: 'http://localhost:3000/health?filter=%5Bname%5D%5Beq%5D%3Dx',
      }).url
    ).toBe('http://localhost:3000/health?filter%5Bname%5D%5Beq%5D=x');
  });

  it('o texto serializado não referencia nada do módulo', () => {
    const text = dqbSwaggerRequestInterceptor(document).toString();
    for (const identifier of [
      'interceptSwaggerRequest',
      'collectDqbGetRouteMatchers',
      'DQB_SWAGGER_EXTENSION_KEY',
      'cov_',
    ]) {
      expect(text).not.toContain(identifier);
    }
  });

  it('expande vários filtros digitados num campo só', () => {
    const interceptor = inBrowser(dqbSwaggerRequestInterceptor(document));

    expect(
      interceptor({
        method: 'GET',
        url:
          '/users?filter=' +
          encodeURIComponent('filter[sku][eq]=A&[stock][gt]=0') +
          '&sort=-name',
      }).url
    ).toBe(
      '/users?filter%5Bsku%5D%5Beq%5D=A&filter%5Bstock%5D%5Bgt%5D=0&sort=-name'
    );
  });

  it('mantém o que não é a forma do formulário, e nunca lança', () => {
    const interceptor = inBrowser(dqbSwaggerRequestInterceptor(document));

    expect(interceptor({ method: 'GET', url: '/users?filter=abc' }).url).toBe(
      '/users?filter=abc'
    );
    expect(interceptor({ method: 'GET', url: '/users?filter=' }).url).toBe(
      '/users?filter'
    );
    expect(interceptor({ method: 'GET', url: '/users' }).url).toBe('/users');
    expect(interceptor({ method: 'GET' }).url).toBeUndefined();
    expect(interceptor({ method: 'GET', url: '/users?' }).url).toBe('/users?');
    expect(
      interceptor({
        method: 'GET',
        url: '/users?filter=%5Bname%5D%5Beq%5D%3Dx#frag',
      }).url
    ).toBe('/users?filter%5Bname%5D%5Beq%5D=x#frag');
  });
});
