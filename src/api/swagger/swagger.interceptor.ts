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
 * Interceptor para o Swagger UI que converte o formato de filtros
 * digitado pelo usuário (`[campo][op]=valor` ou `filter[campo][op]=valor`)
 * para o formato que o qs/Express interpreta corretamente.
 *
 * Quando recebe o documento OpenAPI, limita a interceptacao apenas aos
 * endpoints GET marcados pela lib.
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
export function dqbSwaggerRequestInterceptor(req: SwaggerRequest): SwaggerRequest;
export function dqbSwaggerRequestInterceptor(
  arg: OpenApiDocumentLike | SwaggerRequest
): ((req: SwaggerRequest) => SwaggerRequest) | SwaggerRequest {
  if (isOpenApiDocumentLike(arg)) {
    const dqbGetRouteMatchers = collectDqbGetRouteMatchers(arg);
    return (req: SwaggerRequest) => interceptSwaggerRequest(req, dqbGetRouteMatchers);
  }

  return interceptSwaggerRequest(arg);
}

function isOpenApiDocumentLike(
  value: OpenApiDocumentLike | SwaggerRequest
): value is OpenApiDocumentLike {
  return typeof value === 'object' && value !== null && 'paths' in value;
}

function collectDqbGetRouteMatchers(document: OpenApiDocumentLike): RegExp[] {
  const paths = document.paths ?? {};

  return Object.entries(paths).flatMap(([path, pathItem]) => {
    const getOperation =
      pathItem?.get && typeof pathItem.get === 'object'
        ? (pathItem.get as Record<string, unknown>)
        : undefined;

    if (!getOperation?.[DQB_SWAGGER_EXTENSION_KEY]) {
      return [];
    }

    return [createPathMatcher(path)];
  });
}

function createPathMatcher(path: string): RegExp {
  const escapedPath = path
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\{[^/]+\\\}/g, '[^/]+');

  return new RegExp(`^${escapedPath}$`);
}

function interceptSwaggerRequest(
  req: SwaggerRequest,
  dqbGetRouteMatchers?: RegExp[]
): SwaggerRequest {
  try {
    if (!Array.isArray(req.curlOptions)) req.curlOptions = [];
    if (!req.url) return req;

    if ((req.method ?? 'GET').toUpperCase() !== 'GET') {
      return req;
    }

    const url = new URL(req.url, 'http://swagger.local');
    if (
      dqbGetRouteMatchers &&
      !dqbGetRouteMatchers.some((matcher) => matcher.test(url.pathname))
    ) {
      return req;
    }

    const rawQuery = url.search.slice(1);
    if (!rawQuery) return req;

    const parts = rawQuery
      .split('&')
      .filter(Boolean)
      .map((pair) => normalizeSwaggerQueryParam(pair));

    const nextQuery = parts.join('&');
    const normalizedUrl = `${url.pathname}${nextQuery ? `?${nextQuery}` : ''}`;
    req.url = hasAbsoluteUrl(req.url)
      ? `${url.origin}${normalizedUrl}`
      : normalizedUrl;
  } catch (err) {
    console.error('[DQB] erro no interceptor:', err);
  }
  return req;
}

function normalizeSwaggerQueryParam(pair: string): string {
  const eqIdx = pair.indexOf('=');
  const rawKey = eqIdx === -1 ? pair : pair.slice(0, eqIdx);
  const rawValue = eqIdx === -1 ? '' : pair.slice(eqIdx + 1);

  if (safeDecode(rawKey) !== 'filter') {
    return rawValue ? `${rawKey}=${rawValue}` : rawKey;
  }

  const decodedValue = safeDecode(rawValue).trim();
  if (!decodedValue) return rawKey;

  if (decodedValue.charAt(0) === '[' && decodedValue.indexOf('=') !== -1) {
    return `filter${decodedValue}`;
  }

  if (
    decodedValue.substring(0, 7) === 'filter[' &&
    decodedValue.indexOf('=') !== -1
  ) {
    return decodedValue;
  }

  return rawValue ? `${rawKey}=${rawValue}` : rawKey;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function hasAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}
