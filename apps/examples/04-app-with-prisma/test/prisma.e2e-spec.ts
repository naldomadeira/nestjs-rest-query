import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { PrismaClient } from '../src/generated/prisma/client';
import { dropSchema, resetSchema, seed, SEED_COUNTS } from '../prisma/database';

/**
 * Smoke E2E do exemplo Prisma (gate da §23).
 *
 * Não é a suíte de paridade — essa é a matriz de nove células. O que este
 * arquivo prova é outra coisa, e nenhuma outra suíte prova: que a API pública
 * v3 do adapter Prisma é utilizável **de fora**, por um app NestJS real,
 * contra um PostgreSQL de verdade e pelo caminho documentado no README.
 *
 * O banco é preparado aqui: o schema é recriado, o seed roda e no fim as
 * tabelas são derrubadas.
 *
 * A geração do client fica no script `test:e2e`, e não num `globalSetup`: o
 * spec importa `src/generated/prisma/client` estaticamente, e o `globalSetup`
 * do Jest 30 não é garantidamente anterior ao transform do spec — medido, o
 * primeiro `pnpm test:e2e` de um checkout limpo falhava com `TS2307` mesmo com
 * o `globalSetup` gerando o client. Import dinâmico não resolveria: o
 * typecheck é estático de qualquer forma.
 */

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5434/app_db_prisma';

describe('exemplo 04 — Prisma 7 + PostgreSQL', () => {
  let app: NestExpressApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    // A aplicação lê `DATABASE_URL` na construção do `PrismaService`, então
    // ela precisa estar no ambiente antes de o `AppModule` ser importado.
    process.env.DATABASE_URL = DATABASE_URL;

    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: DATABASE_URL }),
    });
    await resetSchema(prisma);
    await seed(prisma);

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
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    if (prisma) {
      await dropSchema(prisma);
      await prisma.$disconnect();
    }
  });

  const get = (path: string) => request(app.getHttpServer()).get(path);

  describe('envelope e projeção', () => {
    it('pagina e devolve o envelope canônico', async () => {
      const { body } = await get('/users?perPage=2&page=2').expect(200);

      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(body.page).toBe(2);
      expect(body.perPage).toBe(2);
      // `total` conta roots, nunca linhas de join: a relação `many` do Prisma
      // vira `some`, então o root não infla.
      expect(body.total).toBe(SEED_COUNTS.users);
      expect(body.lastPage).toBe(Math.ceil(SEED_COUNTS.users / 2));
    });

    it('projeta exatamente os campos pedidos', async () => {
      const { body } = await get('/users?fields=id,name&perPage=1').expect(200);

      // A coluna dobrada é interna: não aparece no JSON nem quando o campo que
      // ela apoia é projetado. A PK também é removida quando não é visível —
      // aqui `id` foi pedido, então fica.
      expect(Object.keys(body.data[0]).sort()).toEqual(['id', 'name']);
    });

    it('aninha a relação `one` com a projeção dela', async () => {
      const { body } = await get(
        '/users?includes=company&fields=id,company.name&sort=id&perPage=1'
      ).expect(200);

      expect(Object.keys(body.data[0]).sort()).toEqual(['company', 'id']);
      expect(Object.keys(body.data[0].company)).toEqual(['name']);
      expect(body.data[0].company.name).toBe('Acme Elétrica');
    });

    it('devolve `null` na relação `one` sem correspondência', async () => {
      const { body } = await get(
        '/users?includes=company&filter[companyId][isNull]=true'
      ).expect(200);

      expect(body.total).toBe(1);
      expect(body.data[0].company).toBeNull();
    });

    it('devolve array na relação `many`, inclusive vazio', async () => {
      const { body } = await get(
        '/companies?includes=users&fields=id,name,users.name&sort=id'
      ).expect(200);

      const nomes = body.data.map((row: { name: string }) => row.name);
      expect(nomes).toEqual([
        'Acme Elétrica',
        'Elétrica Central',
        'Beta Logística',
      ]);
      expect(body.data[0].users).toEqual([
        { name: 'Ana Souza' },
        { name: 'Bruno Lima' },
      ]);
    });
  });

  describe('whitelist exata', () => {
    it('recusa campo do schema que o endpoint não autoriza na projeção', async () => {
      // `createdAt` é filtrável e ordenável neste endpoint, mas não projetável:
      // na v3 `fields` e `sorts` são listas independentes.
      const { body } = await get('/users?fields=id,createdAt').expect(400);

      expect(body.code).toBe('FIELD_NOT_ALLOWED');
      expect(body.details.path).toBe('createdAt');
      // O envelope de erro nunca carrega o valor enviado pelo cliente.
      expect(body.details).not.toHaveProperty('value');
    });

    it('ordena pelo mesmo campo que recusa projetar', async () => {
      await get('/users?sort=-createdAt&perPage=1').expect(200);
    });

    it('trata a whitelist da relação como exata', async () => {
      // `posts` está em `includes`, e `content` existe no schema de `post` —
      // mas não está em `fields.relations.posts.allowed`. Na v2, autorizar a
      // relação autorizava qualquer campo dela.
      const { body } = await get(
        '/users?includes=posts&fields=id,posts.content'
      ).expect(400);

      expect(body.code).toBe('FIELD_NOT_ALLOWED');
    });

    it('recusa a coluna dobrada, que é interna', async () => {
      const { body } = await get('/users?fields=id,nameFolded').expect(400);

      expect(['FIELD_NOT_ALLOWED', 'FIELD_NOT_FOUND']).toContain(body.code);
    });

    it('recusa operador que o campo não autoriza', async () => {
      // `id` declara apenas `eq` e `in`.
      const { body } = await get('/users?filter[id][gt]=1').expect(400);

      expect(body.code).toBe('OPERATOR_NOT_ALLOWED');
    });

    it('recusa valor que não casa com o tipo do campo', async () => {
      // A v3 coage pelo tipo do campo, não pelo formato do texto: a v2
      // transformaria `10abc` em `10`.
      const { body } = await get('/users?filter[id][eq]=10abc').expect(400);

      expect(body.code).toBe('FILTER_VALUE_INVALID');
    });
  });

  describe('busca portátil por valor dobrado', () => {
    it('não muda o total quando a caixa do termo muda', async () => {
      // `search` compara a coluna dobrada (`name_folded`, `email_folded`) com
      // o termo dobrado pelo mesmo `foldText`, sem `mode: 'insensitive'` do
      // Prisma e sem depender da collation do servidor — que aqui é `C`, ou
      // seja, sensível a caixa. A dobra do perfil `portable-strict` é
      // `NFC` + `toLowerCase`: normaliza a caixa e **não** remove diacrítico.
      const minusculas = await get('/users?search=elétrica&perPage=50').expect(
        200
      );
      const maiusculas = await get('/users?search=ELÉTRICA&perPage=50').expect(
        200
      );

      expect(minusculas.body.total).toBe(maiusculas.body.total);
      expect(minusculas.body.total).toBe(2);
      expect(
        minusculas.body.data.map((row: { name: string }) => row.name).sort()
      ).toEqual(['Carla Elétrica', 'Marta Elétrica']);
    });

    it('`ilike` também compara valor dobrado', async () => {
      const { body } = await get(
        '/users?filter[name][ilike]=CARLA&perPage=50'
      ).expect(200);

      expect(body.total).toBe(1);
      expect(body.data[0].name).toBe('Carla Elétrica');
    });
  });

  describe('operadores de padrão no PostgreSQL', () => {
    /*
     * Estes dois casos são o limite conhecido do adapter Prisma, medido no
     * banco onde ele funciona.
     *
     * O Prisma nunca emite cláusula `ESCAPE`: `contains` compila para
     * `LIKE ('%' || ? || '%')` e o client tipado não deixa acrescentar nada.
     * Só sobra o escape default do dialeto — e PostgreSQL e MySQL têm `\`,
     * então a biblioteca escapa o valor e `%`/`_` continuam **literais**, como
     * a §11 exige. Em SQLite e SQL Server não há default, e lá os cinco
     * operadores de padrão são recusados com `CAPABILITY_UNAVAILABLE` em vez
     * de devolverem o conjunto errado (ADR-001, emenda 2).
     *
     * Ou seja: o texto do `MIGRATION.md` que diz que `%` e `_` se comportam
     * como coringa "under the Prisma adapter" está desatualizado para
     * PostgreSQL. É o que estes dois testes fixam.
     */
    it('trata `%` como caractere literal', async () => {
      const termo = encodeURIComponent('100%');
      const { body } = await get(
        `/posts?filter[title][like]=${termo}&perPage=50`
      ).expect(200);

      expect(body.total).toBe(1);
      expect(body.data[0].title).toBe('Desconto de 100% na conta de luz');
    });

    it('trata `_` como caractere literal', async () => {
      const { body } = await get(
        '/posts?filter[title][like]=a_b&perPage=50'
      ).expect(200);

      expect(body.total).toBe(1);
      expect(body.data[0].title).toBe('Circuito a_b revisado');
    });
  });

  describe('paginação estável sobre PK UUID', () => {
    it('não repete nem perde linha entre páginas', async () => {
      // A PK de `post` é UUID; o desempate sai de `id_order`, declarado como
      // `portableOrderField`. Sem ele o endpoint nem subiria
      // (`CAPABILITY_UNAVAILABLE`).
      const primeira = await get('/posts?perPage=3&page=1&fields=id').expect(
        200
      );
      const segunda = await get('/posts?perPage=3&page=2&fields=id').expect(
        200
      );

      const ids = [...primeira.body.data, ...segunda.body.data].map(
        (row: { id: string }) => row.id
      );

      expect(new Set(ids).size).toBe(SEED_COUNTS.posts);
      expect(ids).toEqual([...ids].sort());
    });
  });
});
