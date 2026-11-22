import type { AddressInfo } from 'node:net';
import { Controller, Get, Inject, type INestApplication } from '@nestjs/common';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { parse } from 'qs';
import { DynamicQueryBuilderModule } from '@core/dynamic-query-builder.module';
import { QueryBuilderService } from '@core/query-builder.v3.service';
import { RestQuery, type QueryInputLike } from '@src/index';
import { fakeSource } from '../fixtures/fake-adapter';
import { RULES_PRESETS } from '../fixtures/rules';

/**
 * NestJS + Fastify, do jeito que o README ensina.
 *
 * O Fastify parseia a query com `fast-querystring`, que é **plano**:
 * `filter[name][eq]=Ada` chega como a chave literal `"filter[name][eq]"`. Sem
 * um parser aninhado nenhum filtro funciona — e o erro tem de dizer isso, não
 * "param desconhecido".
 */

const rules = RULES_PRESETS['user.default'];

@Controller()
class UsersController {
  constructor(
    @Inject(QueryBuilderService) private readonly queries: QueryBuilderService
  ) {}

  @Get('users')
  list(@RestQuery() query: QueryInputLike): unknown {
    return this.queries.execute(fakeSource(), query, rules);
  }

  @Get('echo')
  echo(@RestQuery() query: QueryInputLike): unknown {
    return query;
  }
}

/** A configuração recomendada no README, literal. */
const nestedParser = (querystring: string) =>
  parse(querystring, {
    // `filter[path][in][0]` tem profundidade 3; nada da gramática passa disso.
    depth: 3,
    parameterLimit: 100,
    arrayLimit: 100,
    // `true` partiria `filter[company.name]` no ponto: caminhos de relação
    // usam ponto e não podem ser lidos como aninhamento.
    allowDots: false,
  });

async function bootstrap(
  adapter: FastifyAdapter
): Promise<NestFastifyApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [DynamicQueryBuilderModule.forRoot({})],
    controllers: [UsersController],
  }).compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(adapter, {
    logger: false,
  });
  await app.listen(0, '127.0.0.1');
  return app;
}

async function getJson(
  app: INestApplication,
  path: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  const { port } = app.getHttpServer().address() as AddressInfo;
  const response = await fetch(`http://127.0.0.1:${port}${path}`);
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

const QUERY =
  '?filter[name][eq]=Ada&filter[company.name][ilike]=acme&filter[id][in]=1,2&sort=-name&page=1&perPage=5';

describe('Fastify com o parser aninhado recomendado', () => {
  let app: NestFastifyApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('entrega a gramática aninhada, com caminhos de relação intactos', async () => {
    app = await bootstrap(
      new FastifyAdapter({
        routerOptions: { querystringParser: nestedParser },
      })
    );

    const { status, body } = await getJson(app, `/echo${QUERY}`);

    expect(status).toBe(200);
    expect(body).toEqual({
      filter: {
        name: { eq: 'Ada' },
        'company.name': { ilike: 'acme' },
        id: { in: '1,2' },
      },
      sort: '-name',
      page: '1',
      perPage: '5',
    });
  });

  it('executa a consulta e devolve o envelope paginado', async () => {
    app = await bootstrap(
      new FastifyAdapter({
        routerOptions: { querystringParser: nestedParser },
      })
    );

    const { status, body } = await getJson(
      app,
      '/users?filter[name][eq]=Ada&perPage=5'
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({ page: 1, perPage: 5, total: 1 });
  });

  it('um limite excedido é 400 tipado, também pelo Fastify', async () => {
    app = await bootstrap(
      new FastifyAdapter({
        routerOptions: { querystringParser: nestedParser },
      })
    );

    const ids = Array.from({ length: 101 }, (_, n) => n).join(',');
    const { status, body } = await getJson(app, `/users?filter[id][in]=${ids}`);

    expect(status).toBe(400);
    expect(body).toMatchObject({
      statusCode: 400,
      code: 'QUERY_LIMIT_EXCEEDED',
      details: { param: 'filter', limit: 'maxListItems', max: 100 },
    });
  });
});

describe('Fastify com o parser default (plano)', () => {
  let app: NestFastifyApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('recusa com uma dica que aponta o parser HTTP', async () => {
    app = await bootstrap(new FastifyAdapter());

    const { status, body } = await getJson(app, '/users?filter[name][eq]=Ada');

    expect(status).toBe(400);
    expect(body).toMatchObject({
      code: 'QUERY_SYNTAX_UNKNOWN_PARAM',
      details: {
        param: 'filter[name][eq]',
        hint: 'nested-query-parser-required',
      },
    });
    expect(body.message).toMatch(/nested query string parser/);
  });

  it('params planos da gramática seguem funcionando', async () => {
    app = await bootstrap(new FastifyAdapter());

    const { status } = await getJson(app, '/users?sort=-name&page=1');

    expect(status).toBe(200);
  });
});
