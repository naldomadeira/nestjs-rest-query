import { applyDecorators, Type } from '@nestjs/common';

type ApiExtraModelsFn = (typeof import('@nestjs/swagger'))['ApiExtraModels'];
type ApiResponseFn = (typeof import('@nestjs/swagger'))['ApiResponse'];
type GetSchemaPathFn = (typeof import('@nestjs/swagger'))['getSchemaPath'];

let ApiExtraModels: ApiExtraModelsFn | undefined;
let ApiResponse: ApiResponseFn | undefined;
let getSchemaPath: GetSchemaPathFn | undefined;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ({ ApiExtraModels, ApiResponse, getSchemaPath } = require('@nestjs/swagger'));
} catch {
  // @nestjs/swagger nao instalado — decorator e no-op
}

export interface ApiPaginatedResponseOptions {
  status?: number;
  description?: string;
}

/**
 * Documenta no Swagger o envelope `NormalizedQueryResult<T>` retornado por
 * endpoints paginados.
 *
 * O envelope não mudou na v3 (`data` mais os quatro campos de paginação), mas
 * a chamada em volta dele mudou inteira — e este JSDoc aparece no IntelliSense
 * de quem está migrando, o que faz de um exemplo desatualizado aqui uma
 * instrução errada no pior momento possível.
 *
 * @example
 * ```ts
 * // As regras são compiladas uma vez, fora da classe: o decorator é avaliado
 * // no carregamento do módulo, antes de existir container ou repositório.
 * const userRules = defineQueryRules(registry, 'user', { filters: [...] });
 *
 * @Get()
 * @ApiDynamicQuery(userRules)
 * @ApiPaginatedResponse(User, { description: 'Lista de usuários' })
 * async findAll(
 *   @Query() query: DynamicQueryDto,
 *   @QueryRules() rules: CompiledQueryRules
 * ) {
 *   return this.service.findAll(query, rules);
 * }
 * ```
 */
export function ApiPaginatedResponse<T>(
  model: Type<T>,
  options: ApiPaginatedResponseOptions = {}
): MethodDecorator {
  if (!ApiExtraModels || !ApiResponse || !getSchemaPath) {
    return (_target, _key, descriptor) => descriptor;
  }

  const { status = 200, description } = options;

  return applyDecorators(
    ApiExtraModels(model),
    ApiResponse({
      status,
      description,
      schema: {
        properties: {
          data: {
            type: 'array',
            items: { $ref: getSchemaPath(model) },
          },
          page: { type: 'number', example: 1 },
          perPage: { type: 'number', example: 10 },
          total: { type: 'number', example: 100 },
          lastPage: { type: 'number', example: 10 },
        },
      },
    })
  );
}
