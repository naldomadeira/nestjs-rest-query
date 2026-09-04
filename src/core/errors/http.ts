import {
  BadRequestException,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import { RestQueryError } from './rest-query.error';

/**
 * Ponte para o HTTP do Nest. Único arquivo do núcleo que importa
 * `@nestjs/common`, para que parser, coerção e validação permaneçam puros.
 */
export function toHttpException(error: RestQueryError): HttpException {
  const body = error.toJSON();
  return error.statusCode === 400
    ? new BadRequestException(body)
    : new InternalServerErrorException(body);
}
