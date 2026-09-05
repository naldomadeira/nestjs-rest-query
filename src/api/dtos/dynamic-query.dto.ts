/* eslint-disable @typescript-eslint/no-explicit-any */

export class DynamicQueryDto {
  page?: string;

  perPage?: string;

  paginate?: string;

  sort?: string;

  fields?: string;

  includes?: string;

  filter?: Record<string, Record<string, any> | any>;

  search?: string;

  /**
   * Index signature, e ela é o que torna a DTO utilizável.
   *
   * `QueryBuilderService.execute` recebe `QueryInputLike`, que declara
   * `[key: string]: unknown` porque precisa **enxergar** o param fora da
   * gramática para recusá-lo com `QUERY_SYNTAX_UNKNOWN_PARAM` (400) — a recusa
   * é feita pelo parser, não pelo tipo. TypeScript não dá index signature
   * implícita a *classes* — só a type aliases —, então sem esta linha a DTO
   * exportada pela raiz não é atribuível ao método exportado pela raiz, e todo
   * consumidor que seguisse o uso documentado precisaria de um cast.
   *
   * É type-only: não muda nada em runtime nem na documentação Swagger. Em
   * particular, ela não afrouxa a validação — declarar uma chave extra na DTO
   * compila, mas o valor enviado nela é recusado em runtime.
   */
  [key: string]: unknown;
}

export type PaginationQueryDto = Pick<
  DynamicQueryDto,
  'page' | 'perPage' | 'paginate'
>;
