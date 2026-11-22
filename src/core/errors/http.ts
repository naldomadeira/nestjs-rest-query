import {
  BadRequestException,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  RestQueryError,
  type RestQueryErrorEnvelope,
} from './rest-query.error';

export interface HttpExceptionOptions {
  /**
   * Devolve a mensagem e os `details` de um erro de configuração (500) ao
   * cliente. Desligado, o 500 leva só o `code` e uma mensagem genérica.
   * @default false
   */
  readonly exposeInternalDetails?: boolean;
}

/** O que o cliente lê num 500 quando o detalhe fica no servidor. */
export const INTERNAL_ERROR_MESSAGE =
  'Query configuration error; see the server log';

/**
 * Ponte para o HTTP do Nest. Único arquivo do núcleo que importa
 * `@nestjs/common`, para que parser, coerção e validação permaneçam puros.
 *
 * Um 500 aqui é erro de declaração do desenvolvedor — tabela, coluna, path do
 * schema —, e a mensagem dele nomeia exatamente o que não deve sair para um
 * cliente em produção (consumer report #7). Por isso, por padrão, o corpo leva
 * só o `code`, que é contrato estável, e o detalhe fica para o log. O 400
 * nunca é escondido: ele descreve o input do próprio cliente, e é o que diz a
 * ele o que corrigir.
 */
export function toHttpException(
  error: RestQueryError,
  options: HttpExceptionOptions = {}
): HttpException {
  if (error.statusCode === 400) {
    return new BadRequestException(error.toJSON());
  }

  const body: RestQueryErrorEnvelope = options.exposeInternalDetails
    ? error.toJSON()
    : {
        statusCode: error.statusCode,
        error: 'Internal Server Error',
        code: error.code,
        message: INTERNAL_ERROR_MESSAGE,
      };
  return new InternalServerErrorException(body, { cause: error });
}
