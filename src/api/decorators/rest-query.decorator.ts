import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { configurationError, toHttpException } from '@core/errors';
import type { QueryInputLike } from '@core/query-parser';

/**
 * Query string crua da requisição HTTP, como o parser da gramática a espera.
 *
 * Separada do decorator para poder ser exercitada sem montar uma aplicação.
 */
export function readRestQuery(
  _data: unknown,
  ctx: ExecutionContext
): QueryInputLike {
  if (ctx.getType() !== 'http') {
    throw toHttpException(
      configurationError(
        'SOURCE_CONFIGURATION_INVALID',
        'RestQuery only supports HTTP handlers'
      )
    );
  }

  return ctx.switchToHttp().getRequest<{ query: QueryInputLike }>().query;
}

/**
 * Entrega a query string crua ao handler, sem passar pela DTO.
 *
 * Use no lugar de `@Query() query: DynamicQueryDto` quando a aplicação tem um
 * `ValidationPipe` global com `whitelist` e, principalmente,
 * `forbidNonWhitelisted`: o parâmetro não tem metatype de classe e o
 * `ValidationPipe` não valida decorators customizados, então nenhuma chave é
 * removida nem recusada no caminho. A validação da gramática continua inteira
 * em `QueryBuilderService.execute()`, que recusa param desconhecido com
 * `QUERY_SYNTAX_UNKNOWN_PARAM`.
 *
 * @example
 * ```ts
 * @Get()
 * @ApiDynamicQuery(rules)
 * findAll(@RestQuery() query: QueryInputLike) {
 *   return this.queryBuilder.execute(source, query, rules);
 * }
 * ```
 */
export const RestQuery = createParamDecorator(readRestQuery);
