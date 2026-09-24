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

/**
 * Propriedades declaradas da gramática, na ordem da classe.
 *
 * É a lista que recebe `@Allow()` abaixo; a index signature não entra, porque
 * param fora da gramática é decisão do pipe do consumidor.
 */
const GRAMMAR_PROPERTIES = [
  'page',
  'perPage',
  'paginate',
  'sort',
  'fields',
  'includes',
  'filter',
  'search',
] as const;

type AllowDecoratorFactory = () => PropertyDecorator;

/**
 * `ValidationPipe({ whitelist: true })` sem `@Allow()` (consumer report #4).
 *
 * O whitelist do class-validator remove toda propriedade sem decorator de
 * validação — e esta DTO não tinha nenhum, então o handler recebia um objeto
 * vazio, sem 400 (o Nest força `forbidUnknownValues: false`). Marcar as oito
 * propriedades com `@Allow()` as torna conhecidas sem validar o conteúdo, que
 * é trabalho do parser e do validador semântico.
 *
 * class-validator é peer opcional, carregado sob demanda como o `@nestjs/swagger`.
 * O peer não é enfeite: sem ele, um layout estrito (pnpm) não deixa este pacote
 * resolver o class-validator do consumidor, o `require` falha com
 * `MODULE_NOT_FOUND` e a marcação some calada. Sem ele instalado não há whitelist a satisfazer, e nada é
 * aplicado. Só "módulo ausente" é engolido; qualquer outro erro sobe.
 *
 * O carregamento passa por `module.require`, e não por `require`: o bundler
 * reescreve `require` no bundle ESM para um shim que existe sempre e lança ao
 * ser chamado, o que derrubaria o import do pacote. No ESM não há `module`, a
 * marcação não acontece, e quem roda o Nest como ESM sob whitelist usa
 * `@RestQuery()`.
 */
function allowGrammarProperties(): void {
  if (typeof module !== 'object' || typeof module?.require !== 'function') {
    return;
  }

  let Allow: AllowDecoratorFactory;
  try {
    Allow = (
      module.require('class-validator') as { Allow: AllowDecoratorFactory }
    ).Allow;
  } catch (error) {
    if ((error as { code?: unknown }).code === 'MODULE_NOT_FOUND') return;
    throw error;
  }

  for (const key of GRAMMAR_PROPERTIES) {
    Allow()(DynamicQueryDto.prototype, key);
  }
}

allowGrammarProperties();

export type PaginationQueryDto = Pick<
  DynamicQueryDto,
  'page' | 'perPage' | 'paginate'
>;
