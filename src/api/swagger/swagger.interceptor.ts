/**
 * Interceptor para o Swagger UI que converte o formato de filtros
 * digitado pelo usuário (`[campo][op]=valor` ou `filter[campo][op]=valor`)
 * para o formato que o qs/Express interpreta corretamente
 * @example
 * // main.ts
 * import { dqbSwaggerRequestInterceptor } from 'nestjs-rest-query';
 *
 * SwaggerModule.setup('/docs', app, document, {
 *   swaggerOptions: { requestInterceptor: dqbSwaggerRequestInterceptor },
 * });
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dqbSwaggerRequestInterceptor(req: any): any {
  try {
    if (!Array.isArray(req.curlOptions)) req.curlOptions = [];
    if (!req.url) return req;

    const qIdx = req.url.indexOf('?');
    if (qIdx === -1) return req;

    const basePath = req.url.slice(0, qIdx);
    const rawQuery = req.url.slice(qIdx + 1);
    if (!rawQuery) return req;

    const safeDecode = (s: string) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    };

    const parts = rawQuery
      .split('&')
      .filter(Boolean)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((pair: any) => {
        const eqIdx = pair.indexOf('=');
        const rawKey = eqIdx === -1 ? pair : pair.slice(0, eqIdx);
        const rawValue = eqIdx === -1 ? '' : pair.slice(eqIdx + 1);

        if (safeDecode(rawKey) !== 'filter') {
          return rawValue ? `${rawKey}=${rawValue}` : rawKey;
        }

        const decodedValue = safeDecode(rawValue).trim();
        if (!decodedValue) return rawKey;

        if (
          decodedValue.charAt(0) === '[' &&
          decodedValue.indexOf('=') !== -1
        ) {
          return `filter${decodedValue}`;
        }

        if (
          decodedValue.substring(0, 7) === 'filter[' &&
          decodedValue.indexOf('=') !== -1
        ) {
          return decodedValue;
        }

        return rawValue ? `${rawKey}=${rawValue}` : rawKey;
      });

    req.url = `${basePath}?${parts.join('&')}`;
  } catch (err) {
    console.error('[DQB] erro no interceptor:', err);
  }
  return req;
}
