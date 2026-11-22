import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DynamicQueryBuilderModule } from '@core/dynamic-query-builder.module';
import { configurationError, inputError, toHttpException } from '@core/errors';
import { QueryBuilderService } from '@core/query-builder.v3.service';
import { defineQuerySchema, type QuerySchema } from '@core/schema';
import type { LoggerLike } from '@contracts/query-builder-config.interface';
import { calls, fakeSource } from '../fixtures/fake-adapter';
import { RULES_PRESETS } from '../fixtures/rules';
import { userSchema } from '../fixtures/schemas';

/**
 * Defeito #7 da validação externa do `3.0.0-alpha.0`: quatro arestas que não
 * quebravam requisição nenhuma, mas que um consumidor em produção sente.
 */

const rules = RULES_PRESETS['user.default'];

const wrongSchema = defineQuerySchema({
  model: 'company',
  primaryKey: ['id'],
  fields: [{ path: 'id', kind: 'integer', nullable: false, primaryKey: true }],
  relations: [],
});

function recordingLogger(): LoggerLike & { errors: unknown[][] } {
  const errors: unknown[][] = [];
  return {
    errors,
    log: () => undefined,
    warn: () => undefined,
    debug: () => undefined,
    error: (...args: unknown[]) => {
      errors.push(args);
    },
  };
}

describe('#7 — envelope de erro com `error`', () => {
  it('o 400 traz `error`, como todo HttpException do Nest', () => {
    const body = toHttpException(
      inputError('SORT_CONFLICT', 'conflito', { path: 'name' })
    ).getResponse();

    expect(body).toEqual({
      statusCode: 400,
      error: 'Bad Request',
      code: 'SORT_CONFLICT',
      message: 'conflito',
      details: { path: 'name' },
    });
  });

  it('toJSON também traz `error`', () => {
    expect(inputError('SORT_CONFLICT', 'conflito').toJSON()).toEqual({
      statusCode: 400,
      error: 'Bad Request',
      code: 'SORT_CONFLICT',
      message: 'conflito',
    });
  });
});

describe('#7 — erro de configuração não vaza nomes internos', () => {
  const internal = configurationError(
    'SOURCE_CONFIGURATION_INVALID',
    'Drizzle table users has no column declared for field password_hash',
    { table: 'users', field: 'password_hash' }
  );

  it('por padrão o 500 leva só o código e uma mensagem genérica', () => {
    const exception = toHttpException(internal);

    expect(exception).toBeInstanceOf(InternalServerErrorException);
    expect(exception.getResponse()).toEqual({
      statusCode: 500,
      error: 'Internal Server Error',
      code: 'SOURCE_CONFIGURATION_INVALID',
      message: 'Query configuration error; see the server log',
    });
    expect(JSON.stringify(exception.getResponse())).not.toContain(
      'password_hash'
    );
  });

  it('com exposeInternalDetails o 500 leva mensagem e detalhes', () => {
    expect(
      toHttpException(internal, { exposeInternalDetails: true }).getResponse()
    ).toEqual({
      statusCode: 500,
      error: 'Internal Server Error',
      code: 'SOURCE_CONFIGURATION_INVALID',
      message:
        'Drizzle table users has no column declared for field password_hash',
      details: { table: 'users', field: 'password_hash' },
    });
  });

  it('o 400 nunca é escondido: o cliente precisa saber o que corrigir', () => {
    expect(
      toHttpException(inputError('FIELD_NOT_ALLOWED', 'x', { path: 'a' }))
    ).toBeInstanceOf(BadRequestException);
  });

  it('o serviço esconde o detalhe e o registra no log, mesmo com log desligado', async () => {
    const logger = recordingLogger();
    const service = new QueryBuilderService({
      logging: { enabled: false, logger },
    });

    const failure = await service
      .execute(fakeSource({}, wrongSchema), {}, rules)
      .catch((error: InternalServerErrorException) => error);

    expect(failure).toBeInstanceOf(InternalServerErrorException);
    const body = (failure as InternalServerErrorException).getResponse();
    expect(body).toEqual({
      statusCode: 500,
      error: 'Internal Server Error',
      code: 'SOURCE_CONFIGURATION_INVALID',
      message: 'Query configuration error; see the server log',
    });

    // A resposta perdeu o detalhe; o log é onde o desenvolvedor o encontra.
    expect(logger.errors).toHaveLength(1);
    expect(logger.errors[0][1]).toEqual(
      expect.objectContaining({
        code: 'SOURCE_CONFIGURATION_INVALID',
        details: expect.objectContaining({ actual: 'company' }),
      })
    );
  });

  it('forRoot({ errors: { exposeInternalDetails: true } }) devolve o detalhe', async () => {
    const service = new QueryBuilderService({
      errors: { exposeInternalDetails: true },
      logging: { logger: recordingLogger() },
    });

    await expect(
      service.execute(fakeSource({}, wrongSchema), {}, rules)
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        details: expect.objectContaining({ actual: 'company' }),
      }),
    });
  });

  it('forRoot valida e congela a opção', () => {
    DynamicQueryBuilderModule.forRoot({});
    expect(DynamicQueryBuilderModule.config.errors).toEqual({
      exposeInternalDetails: false,
    });
    expect(Object.isFrozen(DynamicQueryBuilderModule.config.errors)).toBe(true);

    expect(() =>
      DynamicQueryBuilderModule.forRoot({
        errors: { exposeInternalDetails: 'true' as never },
      })
    ).toThrow(
      expect.objectContaining({ code: 'SOURCE_CONFIGURATION_INVALID' })
    );
  });
});

describe('#7 — cache de schema com source criada por requisição', () => {
  beforeEach(() => {
    calls.length = 0;
  });

  /**
   * Uma source nova por requisição é o uso que o README ensina
   * (`execute(typeormSource(this.repo), ...)`). O cache por objeto source
   * nunca acertava nesse caso; a validação contra as regras era refeita em
   * toda requisição. Com o schema memoizado pelo adapter, o par
   * (regras, schema) é a identidade que importa.
   */
  it('não revalida o mesmo schema contra as mesmas regras', async () => {
    let reads = 0;
    const counted = new Proxy(userSchema, {
      get(target, property, receiver) {
        if (property === 'fields') reads++;
        return Reflect.get(target, property, receiver);
      },
    }) as QuerySchema;

    const service = new QueryBuilderService({});

    await service.execute(fakeSource({}, counted), {}, rules);
    const afterFirst = reads;
    expect(afterFirst).toBeGreaterThan(0);

    await service.execute(fakeSource({}, counted), {}, rules);
    await service.execute(fakeSource({}, counted), {}, rules);

    expect(reads).toBe(afterFirst);
    expect(calls.filter((call) => call.kind === 'compile')).toHaveLength(3);
  });

  it('schema diferente ainda é validado, e o errado ainda falha', async () => {
    const service = new QueryBuilderService({
      logging: { logger: recordingLogger() },
    });

    await service.execute(fakeSource(), {}, rules);
    await expect(
      service.execute(fakeSource({}, wrongSchema), {}, rules)
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
