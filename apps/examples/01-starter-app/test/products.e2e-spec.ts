import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Smoke E2E do exemplo (gate da §23).
 *
 * Não é a suíte de paridade — essa é a matriz de nove células. O que este
 * arquivo prova é outra coisa, e nenhuma outra suíte prova: que a API pública
 * é utilizável **de fora**, por um app NestJS real, pelo caminho documentado no
 * README. Foi compilando este exemplo com `strict` que apareceu a
 * `DynamicQueryDto` não atribuível ao próprio `execute()`.
 */
describe('GET /products', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  const get = (query: string) =>
    request(app.getHttpServer()).get(`/products${query}`);

  it('pagina e devolve o envelope canônico', async () => {
    const { body } = await get('?perPage=5').expect(200);

    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeLessThanOrEqual(5);
    expect(typeof body.total).toBe('number');
  });

  it('projeta exatamente os campos pedidos', async () => {
    const { body } = await get('?fields=id,name&perPage=1').expect(200);

    // A coluna dobrada é interna: não aparece no JSON nem quando o campo que
    // ela apoia é projetado.
    expect(Object.keys(body.data[0]).sort()).toEqual(['id', 'name']);
  });

  it('aninha a relação autorizada, com a projeção dela', async () => {
    const { body } = await get(
      '?includes=category&fields=id,category.name&perPage=1',
    ).expect(200);

    expect(body.data[0].category).toHaveProperty('name');
  });

  it('recusa campo fora da whitelist, sem tocar no banco', async () => {
    const { body } = await get('?fields=id,updatedAt').expect(400);

    expect(body.code).toBe('FIELD_NOT_ALLOWED');
  });

  it('recusa operador que o campo não autoriza', async () => {
    // `id` declara apenas `eq` e `in`.
    const { body } = await get('?filter[id][gt]=1').expect(400);

    expect(body.code).toBe('OPERATOR_NOT_ALLOWED');
  });

  it('trata a whitelist de relação como exata', async () => {
    // Autorizar `category` não autoriza `category.id` na projeção se ela não
    // estiver declarada — aqui está, então o que falha é o campo inexistente.
    const { body } = await get('?includes=category&fields=category.slug').expect(
      400,
    );

    expect(['FIELD_NOT_ALLOWED', 'FIELD_NOT_FOUND']).toContain(body.code);
  });

  it('busca pelo valor dobrado, sem depender da collation', async () => {
    // `search` compara a coluna dobrada, então o acento e a caixa do termo não
    // mudam o conjunto devolvido.
    const semAcento = await get('?search=eletrico&perPage=50').expect(200);
    const comAcento = await get('?search=ELÉTRICO&perPage=50').expect(200);

    expect(semAcento.body.total).toBe(comAcento.body.total);
  });
});
