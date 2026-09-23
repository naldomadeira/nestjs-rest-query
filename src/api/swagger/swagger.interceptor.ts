export const DQB_SWAGGER_EXTENSION_KEY = 'x-dqb-dynamic-query';

type SwaggerRequest = {
  url?: string;
  method?: string;
  curlOptions?: unknown[];
};

type OpenApiDocumentLike = {
  paths?: Record<string, { get?: unknown } | undefined>;
};

/**
 * Interceptor para o Swagger UI que converte o formato de filtros digitado
 * pelo usuário (`[campo][op]=valor` ou `filter[campo][op]=valor`, vários
 * separados por `&`) para os pares `filter[campo][op]=valor` que o parser
 * espera.
 *
 * Quando recebe o documento OpenAPI, devolve um interceptor que só reescreve
 * os endpoints GET marcados pela lib. Recebendo a própria requisição, reescreve
 * qualquer GET.
 *
 * **Tudo aqui é autocontido, e isso é contrato, não estilo.** O
 * `@nestjs/swagger` grava `swaggerOptions` no `swagger-ui-init.js` com
 * `fn.toString()`, então a função roda **no browser**, sem nenhum escopo deste
 * módulo. Até a `3.0.0-alpha.0` o interceptor devolvido era uma closure sobre
 * helpers do módulo (`interceptSwaggerRequest`, os matchers): no browser eles
 * não existiam, e todo "Try it out" do Swagger UI falhava com `ReferenceError`
 * (relato de consumidor externo, bug #3). Por isso:
 *
 * - o corpo desta função não referencia nada de fora dela — nem constante do
 *   módulo, nem import, nem helper;
 * - a forma com documento devolve uma função criada por `new Function`, cujo
 *   texto embute os padrões de rota como literal JSON. É a única forma de um
 *   dado calculado no servidor sobreviver ao `toString()`.
 *
 * `swagger-interceptor.spec.ts` avalia o texto serializado num contexto `vm`
 * vazio, que é o que o browser recebe. O `istanbul ignore` abaixo existe pelo
 * mesmo motivo: a instrumentação de cobertura injetaria contadores globais no
 * corpo e tornaria o texto serializado dependente do processo de teste.
 *
 * @example
 * ```ts
 * SwaggerModule.setup('/docs', app, document, {
 *   swaggerOptions: {
 *     requestInterceptor: dqbSwaggerRequestInterceptor(document),
 *   },
 * });
 * ```
 */
export function dqbSwaggerRequestInterceptor(
  document: OpenApiDocumentLike
): (req: SwaggerRequest) => SwaggerRequest;
export function dqbSwaggerRequestInterceptor(
  req: SwaggerRequest
): SwaggerRequest;
/* istanbul ignore next -- ver o JSDoc: o texto desta função vai ao browser */
export function dqbSwaggerRequestInterceptor(
  arg: OpenApiDocumentLike | SwaggerRequest
): ((req: SwaggerRequest) => SwaggerRequest) | SwaggerRequest {
  function intercept(
    req: SwaggerRequest,
    routePatterns: readonly string[] | null
  ): SwaggerRequest {
    function decode(value: string): string {
      try {
        return decodeURIComponent(value.replace(/\+/g, ' '));
      } catch {
        return value;
      }
    }

    function encodePair(expression: string): string {
      const separator = expression.indexOf('=');
      if (separator === -1) return encodeURIComponent(expression);
      return (
        encodeURIComponent(expression.slice(0, separator)) +
        '=' +
        encodeURIComponent(expression.slice(separator + 1))
      );
    }

    /** `filter=<expressões>` -> pares `filter[...]`; o resto passa intacto. */
    function expand(pair: string): string[] {
      const separator = pair.indexOf('=');
      const rawKey = separator === -1 ? pair : pair.slice(0, separator);
      if (decode(rawKey) !== 'filter' || separator === -1) return [pair];

      const value = decode(pair.slice(separator + 1)).trim();
      if (!value) return [rawKey];

      const expressions = value.split('&').filter(Boolean);
      const expanded: string[] = [];
      for (const expression of expressions) {
        const full =
          expression.charAt(0) === '[' ? 'filter' + expression : expression;
        if (full.slice(0, 7) !== 'filter[' || full.indexOf('=') === -1) {
          // Não é a forma que o formulário produz: manda como veio.
          return [pair];
        }
        expanded.push(encodePair(full));
      }
      return expanded;
    }

    try {
      if (!Array.isArray(req.curlOptions)) req.curlOptions = [];
      if (!req.url) return req;
      if ((req.method || 'GET').toUpperCase() !== 'GET') return req;

      const url = req.url;
      const hashStart = url.indexOf('#');
      const beforeHash = hashStart === -1 ? url : url.slice(0, hashStart);
      const hash = hashStart === -1 ? '' : url.slice(hashStart);
      const queryStart = beforeHash.indexOf('?');
      if (queryStart === -1) return req;

      const base = beforeHash.slice(0, queryStart);
      const rawQuery = beforeHash.slice(queryStart + 1);
      if (!rawQuery) return req;

      if (routePatterns) {
        const pathname = base.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, '');
        let marked = false;
        for (const pattern of routePatterns) {
          if (new RegExp(pattern).test(pathname || '/')) {
            marked = true;
            break;
          }
        }
        if (!marked) return req;
      }

      const parts: string[] = [];
      for (const pair of rawQuery.split('&')) {
        if (!pair) continue;
        for (const part of expand(pair)) parts.push(part);
      }

      req.url = base + (parts.length ? '?' + parts.join('&') : '') + hash;
    } catch (error) {
      // Nunca derruba a requisição do Swagger UI: na dúvida, vai como veio.
      console.error('[nestjs-rest-query] swagger request interceptor:', error);
    }
    return req;
  }

  const isDocument =
    typeof arg === 'object' &&
    arg !== null &&
    'paths' in arg &&
    !('url' in arg);
  if (!isDocument) return intercept(arg as SwaggerRequest, null);

  const patterns: string[] = [];
  const paths = (arg as OpenApiDocumentLike).paths || {};
  for (const path of Object.keys(paths)) {
    const get = paths[path] && paths[path]!.get;
    if (
      !get ||
      typeof get !== 'object' ||
      !(get as Record<string, unknown>)['x-dqb-dynamic-query']
    ) {
      continue;
    }
    patterns.push(
      '^' +
        path
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          .replace(/\\\{[^/]+?\\\}/g, '[^/]+') +
        '$'
    );
  }

  // `new Function` e não uma closure: o texto desta função é o que o
  // `@nestjs/swagger` serializa, e só assim os padrões viajam junto.
  return new Function(
    'req',
    'return (' +
      intercept.toString() +
      ')(req, ' +
      JSON.stringify(patterns) +
      ');'
  ) as (req: SwaggerRequest) => SwaggerRequest;
}
