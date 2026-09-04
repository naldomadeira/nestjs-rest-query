import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';

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
  let app: NestExpressApplication;
  let workdir: string;

  beforeAll(async () => {
    // Banco descartável por execução: o schema é sincronizado e a migration de
    // seed roda do zero, então o smoke não depende do `database.sqlite` que o
    // desenvolvedor tem em disco.
    workdir = mkdtempSync(join(tmpdir(), 'starter-e2e-'));
    process.env.DATABASE_PATH = join(workdir, 'database.sqlite');

    // `synchronize` cria o schema; a migration de seed popula. No TypeORM 1.x
    // a ordem dentro de `initialize()` é migrations-antes-de-synchronize, então
    // as duas etapas são disparadas aqui, em sequência explícita.
    const { dataSource } =
      await import('../src/database/database-migrations.config');
    await dataSource.initialize();
    await dataSource.runMigrations();
    await dataSource.destroy();

    const { AppModule } = await import('../src/app.module');

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    // Mesmo ajuste do `main.ts`: o Express 5 trocou o parser de query padrão
    // de 'extended' para 'simple', e `filter[campo][op]=valor` só chega como
    // objeto aninhado com o parser estendido. Sem isto o smoke aceitaria
    // silenciosamente um filtro que nunca foi aplicado.
    app.set('query parser', 'extended');
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    if (workdir) rmSync(workdir, { recursive: true, force: true });
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
    const { body } = await get(
      '?includes=category&fields=category.slug',
    ).expect(400);

    expect(['FIELD_NOT_ALLOWED', 'FIELD_NOT_FOUND']).toContain(body.code);
  });

  it('busca pelo valor dobrado, sem depender da collation', async () => {
    // `search` compara a coluna dobrada com o termo dobrado pelo mesmo
    // `foldText`. A dobra do perfil `portable-strict` é `NFC` + `toLowerCase`:
    // normaliza a caixa, e não remove diacrítico. Então o que a busca promete
    // é que a *caixa* do termo não muda o conjunto devolvido, em qualquer
    // banco e qualquer collation.
    const minusculas = await get('?search=elétrica&perPage=50').expect(200);
    const maiusculas = await get('?search=ELÉTRICA&perPage=50').expect(200);

    expect(minusculas.body.total).toBe(maiusculas.body.total);
    expect(minusculas.body.total).toBeGreaterThan(0);
  });
});
