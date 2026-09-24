import type { AddressInfo } from 'node:net';
import {
  Controller,
  Get,
  InternalServerErrorException,
  Query,
  ValidationPipe,
  type ExecutionContext,
  type INestApplication,
} from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { DynamicQueryDto, RestQuery, type QueryInputLike } from '@src/index';
import { readRestQuery } from '@api/decorators/rest-query.decorator';

/**
 * `@Query() query: DynamicQueryDto` sob `ValidationPipe({ whitelist: true })`
 * (consumer report #4).
 *
 * A DTO não tinha decorator do class-validator, então o whitelist removia as
 * oito propriedades e o handler recebia um objeto vazio — sem 400, porque o
 * Nest força `forbidUnknownValues: false`. A consulta simplesmente deixava de
 * filtrar, ordenar e paginar.
 */
const plainQuery = {
  page: '2',
  perPage: '5',
  paginate: 'true',
  sort: '-name',
  fields: 'id,name',
  includes: 'company',
  filter: { name: { eq: 'Ada' }, 'company.name': { ilike: 'acme' } },
  search: 'ada',
};

describe('regression: DynamicQueryDto under a whitelist ValidationPipe (consumer report #4)', () => {
  it('mantém os oito parâmetros da gramática', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const result = await pipe.transform(
      { ...plainQuery },
      { type: 'query', metatype: DynamicQueryDto }
    );

    expect(result).toBeInstanceOf(DynamicQueryDto);
    expect({ ...result }).toEqual(plainQuery);
  });

  it('continua recusando param fora da gramática com forbidNonWhitelisted', async () => {
    // O whitelist só passou a enxergar a gramática; o que está fora dela
    // continua sendo decisão do pipe do consumidor.
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    await expect(
      pipe.transform(
        { ...plainQuery, utm_source: 'newsletter' },
        { type: 'query', metatype: DynamicQueryDto }
      )
    ).rejects.toThrow();
  });
});

describe('DynamicQueryDto sem class-validator instalado', () => {
  afterEach(() => {
    jest.dontMock('class-validator');
  });

  it('carrega sem aplicar decorator quando o pacote não existe', () => {
    jest.isolateModules(() => {
      jest.doMock('class-validator', () => {
        throw Object.assign(new Error("Cannot find module 'class-validator'"), {
          code: 'MODULE_NOT_FOUND',
        });
      });
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const dto = require('@api/dtos/dynamic-query.dto');
      expect(typeof dto.DynamicQueryDto).toBe('function');
    });
  });

  it('não engole erro que não seja de módulo ausente', () => {
    jest.isolateModules(() => {
      jest.doMock('class-validator', () => {
        throw new Error('class-validator exploded');
      });
      expect(() =>
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('@api/dtos/dynamic-query.dto')
      ).toThrow('class-validator exploded');
    });
  });
});

describe('@RestQuery', () => {
  it('recusa contexto que não seja HTTP', () => {
    const context = { getType: () => 'rpc' } as unknown as ExecutionContext;

    expect(() => readRestQuery(undefined, context)).toThrow(
      InternalServerErrorException
    );
  });
});

@Controller()
class QueryController {
  @Get('dto')
  dto(@Query() query: DynamicQueryDto): unknown {
    return { ...query };
  }

  @Get('raw')
  raw(@RestQuery() query: QueryInputLike): unknown {
    return query;
  }
}

async function bootstrap(pipe: ValidationPipe): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    controllers: [QueryController],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    logger: false,
  });
  // Express 5 usa o parser `simple` por default; `filter[a][eq]` só vira
  // objeto aninhado com `extended`, como a documentação pede.
  app.set('query parser', 'extended');
  app.useGlobalPipes(pipe);
  await app.listen(0, '127.0.0.1');
  return app;
}

async function getJson(
  app: INestApplication,
  path: string
): Promise<{ status: number; body: unknown }> {
  const { port } = app.getHttpServer().address() as AddressInfo;
  const response = await fetch(`http://127.0.0.1:${port}${path}`);
  return { status: response.status, body: await response.json() };
}

const QUERY_STRING =
  '?page=2&perPage=5&sort=-name&filter[name][eq]=Ada&filter[company.name][ilike]=acme';
const EXPECTED = {
  page: '2',
  perPage: '5',
  sort: '-name',
  filter: { name: { eq: 'Ada' }, 'company.name': { ilike: 'acme' } },
};

describe('controller HTTP sob ValidationPipe global', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('@Query() DynamicQueryDto recebe o filter aninhado intacto', async () => {
    app = await bootstrap(new ValidationPipe({ whitelist: true }));

    const response = await getJson(app, `/dto${QUERY_STRING}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(EXPECTED);
  });

  it('@RestQuery() ignora um pipe que recusaria qualquer chave', async () => {
    app = await bootstrap(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })
    );

    const response = await getJson(app, `/raw${QUERY_STRING}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(EXPECTED);
  });
});
