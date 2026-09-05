import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  RestQueryError,
  inputError,
  configurationError,
  toHttpException,
  RestQueryErrorCode,
} from '@core/errors';

describe('RestQueryError', () => {
  it('serializa o envelope público do spec §17.1', () => {
    const err = inputError(
      'FILTER_VALUE_INVALID',
      'Valor inválido para o campo age',
      { path: 'age', operator: 'gte', expected: 'integer' }
    );

    expect(err).toBeInstanceOf(RestQueryError);
    expect(err.toJSON()).toEqual({
      statusCode: 400,
      code: 'FILTER_VALUE_INVALID',
      message: 'Valor inválido para o campo age',
      details: { path: 'age', operator: 'gte', expected: 'integer' },
    });
  });

  it('omite details quando não há detalhes', () => {
    expect(inputError('SORT_CONFLICT', 'conflito').toJSON()).toEqual({
      statusCode: 400,
      code: 'SORT_CONFLICT',
      message: 'conflito',
    });
  });

  it('erros de configuração são 500', () => {
    const err = configurationError(
      'SOURCE_CONFIGURATION_INVALID',
      'sem PK portável'
    );
    expect(err.statusCode).toBe(500);
  });

  it('converte erro de input em BadRequestException com o mesmo body', () => {
    const err = inputError('FIELD_NOT_ALLOWED', 'campo não permitido', {
      path: 'secret',
    });
    const http = toHttpException(err);
    expect(http).toBeInstanceOf(BadRequestException);
    expect(http.getResponse()).toEqual(err.toJSON());
  });

  it('converte erro de configuração em InternalServerErrorException', () => {
    const http = toHttpException(
      configurationError('ADAPTER_CONTRACT_VIOLATION', 'x')
    );
    expect(http).toBeInstanceOf(InternalServerErrorException);
  });

  it('nunca expõe stack, SQL ou conexão no envelope', () => {
    const json = JSON.stringify(
      inputError('FILTER_VALUE_INVALID', 'x', { path: 'a' })
    );
    expect(json).not.toContain('stack');
    expect(json).not.toContain('SELECT');
  });

  it('congela os detalhes para que não sejam mutados depois', () => {
    const details = { path: 'age' };
    const err = inputError('FILTER_VALUE_INVALID', 'x', details);
    expect(() => {
      (err.details as { path: string }).path = 'other';
    }).toThrow();
  });

  it('expõe todos os códigos do contrato', () => {
    expect(Object.keys(RestQueryErrorCode).sort()).toEqual(
      [
        'ADAPTER_CONTRACT_VIOLATION',
        'CAPABILITY_UNAVAILABLE',
        'FIELD_NOT_ALLOWED',
        'FIELD_NOT_FOUND',
        'FILTER_VALUE_INVALID',
        'OPERATOR_NOT_ALLOWED',
        'OPERATOR_TYPE_MISMATCH',
        'PAGINATION_INVALID',
        'PORTABILITY_PROFILE_MISMATCH',
        'QUERY_SYNTAX_INVALID',
        'QUERY_SYNTAX_UNKNOWN_PARAM',
        'RELATION_NOT_FOUND',
        'SORT_CONFLICT',
        'SOURCE_CONFIGURATION_INVALID',
      ].sort()
    );
  });

  it('mantém o nome da classe estável para instanceof entre bundles', () => {
    expect(inputError('SORT_CONFLICT', 'x').name).toBe('RestQueryError');
  });
});
