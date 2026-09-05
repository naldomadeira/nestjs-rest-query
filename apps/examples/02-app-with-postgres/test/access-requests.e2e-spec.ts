import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';

/**
 * Smoke E2E do exemplo 02, contra PostgreSQL de verdade (gate da §23).
 *
 * Não é a suíte de paridade — essa é a matriz de nove células. O que este
 * arquivo prova é outra coisa, e nenhuma outra suíte prova: que a API pública
 * é utilizável **de fora**, por um app NestJS real, pelo caminho documentado —
 * e que o perfil `portable-strict` (coluna dobrada, padrão literal) se comporta
 * no PostgreSQL como se comporta no SQLite do exemplo 01.
 *
 * O banco é criado e destruído aqui. O `multi_acessos` de desenvolvimento
 * nunca é tocado: uma suíte que roda `DROP` no banco onde o desenvolvedor tem
 * dados não é um teste, é uma armadilha.
 */

const ADMIN_DATABASE = 'postgres';
const E2E_DATABASE = 'multi_acessos_e2e';

const CONNECTION = {
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
};

/** Totais da massa determinística da migration `SeedSampleData`. */
const SEEDED_USERS = 12;
const SEEDED_COMPANIES = 4;
const SEEDED_MODULES = 4;
const SEEDED_ACTIVE_MODULES = 3;
const SEEDED_REQUESTS = SEEDED_USERS * 2;

/**
 * Executa DDL de banco pela conexão administrativa.
 *
 * Usa o `DataSource` do TypeORM, e não o `pg` diretamente, por um motivo
 * prosaico: `@types/pg` não é dependência deste exemplo, e encaixar o driver
 * cru custaria um `declare module` ou um cast — nenhum dos dois aceitável num
 * exemplo cujo propósito é provar que a API pública se usa sem cast.
 *
 * `CREATE`/`DROP DATABASE` não podem rodar dentro de transação, e
 * `dataSource.query` não abre nenhuma.
 */
async function withAdmin(run: (admin: DataSource) => Promise<void>) {
  const admin = new DataSource({
    type: 'postgres',
    host: CONNECTION.host,
    port: CONNECTION.port,
    username: CONNECTION.username,
    password: CONNECTION.password,
    database: ADMIN_DATABASE,
  });
  await admin.initialize();
  try {
    await run(admin);
  } finally {
    await admin.destroy();
  }
}

describe('exemplo 02 — API v3 sobre PostgreSQL', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    await withAdmin(async (admin) => {
      // `FORCE` derruba conexões remanescentes de uma execução interrompida;
      // sem isso um watcher aberto deixa o `DROP` pendurado para sempre.
      await admin.query(
        `DROP DATABASE IF EXISTS "${E2E_DATABASE}" WITH (FORCE)`,
      );
      await admin.query(`CREATE DATABASE "${E2E_DATABASE}"`);
    });

    // A aplicação lê a conexão do ConfigService, então configurar o ambiente
    // aqui é o que aponta o app para o banco descartável. Tem de acontecer
    // antes do `import` do AppModule: o `forRootAsync` resolve na subida.
    process.env.DB_HOST = CONNECTION.host;
    process.env.DB_PORT = String(CONNECTION.port);
    process.env.DB_USERNAME = CONNECTION.username;
    process.env.DB_PASSWORD = CONNECTION.password;
    process.env.DB_NAME = E2E_DATABASE;

    // Import dinâmico, e não estático no topo: o módulo tem de ser avaliado
    // depois das variáveis acima, e `@nestjs/typeorm@12` é ESM puro.
    const { AppModule } = await import('../src/app.module');

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    // Mesmo ajuste do `main.ts`: o Express 5 trocou o parser de query padrão de
    // 'extended' para 'simple', e `filter[campo][op]=valor` só chega como
    // objeto aninhado com o parser estendido. Sem isto o smoke aceitaria
    // silenciosamente um filtro que nunca foi aplicado.
    app.set('query parser', 'extended');
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    // `migrationsRun: true` no DatabaseModule aplica as seis migrations —
    // incluindo as colunas dobradas e o seed — sobre o banco recém-criado.
    await app.init();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await withAdmin(async (admin) => {
      await admin.query(
        `DROP DATABASE IF EXISTS "${E2E_DATABASE}" WITH (FORCE)`,
      );
    });
  }, 60_000);

  /**
   * Os testes montam a query string já escapada, com `encodeURIComponent` nos
   * termos acentuados: o cliente HTTP do Node manda bytes latin-1 para
   * caracteres acima de ASCII, e aí o que chega ao servidor não é o termo que
   * o teste escreveu — a asserção passaria a medir o transporte, não a dobra.
   */
  const get = (path: string) => request(app.getHttpServer()).get(path);

  describe('GET /users', () => {
    it('devolve o envelope canônico com paginação', async () => {
      const { body } = await get('/users?perPage=5').expect(200);

      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toHaveLength(5);
      expect(body.page).toBe(1);
      expect(body.perPage).toBe(5);
      expect(body.total).toBe(SEEDED_USERS);
      expect(body.lastPage).toBe(3);
    });

    it('projeta exatamente os campos pedidos, sem PK nem coluna dobrada', async () => {
      const { body } = await get(
        '/users?fields=username,email&perPage=1',
      ).expect(200);

      // Duas garantias num só assert: a PK é selecionada internamente para
      // hidratação e paginação mas **removida** do JSON quando não foi pedida
      // (a v2 sempre a injetava), e as colunas dobradas são internas — não
      // aparecem nem quando o campo que elas apoiam é projetado.
      expect(Object.keys(body.data[0]).sort()).toEqual(['email', 'username']);
    });

    it('recusa campo fora da whitelist, com código no corpo', async () => {
      // `updatedAt` existe no schema e na tabela; simplesmente não está
      // autorizado. O corpo é envelope estável, então o cliente decide pelo
      // `code` e não pela mensagem.
      const { body } = await get('/users?fields=id,updatedAt').expect(400);

      expect(body.code).toBe('FIELD_NOT_ALLOWED');
      expect(body.details.path).toBe('updatedAt');
    });

    it('recusa operador que o campo não autoriza', async () => {
      // `id` declara apenas `eq` e `in`. Na v3 a lista de operadores é por
      // campo; não existe mais lista global.
      const { body } = await get('/users?filter[id][gt]=1').expect(400);

      expect(body.code).toBe('OPERATOR_NOT_ALLOWED');
    });

    it('mantém zeros à esquerda no filtro de documento', async () => {
      // A v2 coagia pelo formato do texto: `"00000000001"` virava `1` e nunca
      // casava com a coluna. A v3 coage pelo tipo do campo, que aqui é string.
      const { body } = await get(
        '/users?filter[document][eq]=00000000001&fields=id,username',
      ).expect(200);

      expect(body.total).toBe(1);
      expect(body.data[0].username).toBe('antonio.silva');
    });

    it('busca pelo valor dobrado: a caixa do termo não muda o total', async () => {
      // `search` compara a coluna dobrada com o termo dobrado pelo mesmo
      // `foldText`. A dobra do perfil `portable-strict` é NFC + toLowerCase:
      // normaliza a caixa e **não** remove diacrítico. O que a busca promete,
      // então, é que a caixa do termo não muda o conjunto devolvido — em
      // qualquer banco e qualquer collation, sem depender de ILIKE.
      const minusculas = await get(
        `/users?search=${encodeURIComponent('antônio')}&perPage=50`,
      ).expect(200);
      const maiusculas = await get(
        `/users?search=${encodeURIComponent('ANTÔNIO')}&perPage=50`,
      ).expect(200);

      expect(minusculas.body.total).toBeGreaterThan(0);
      expect(minusculas.body.total).toBe(maiusculas.body.total);
      expect(minusculas.body.data).toEqual(maiusculas.body.data);
    });
  });

  describe('GET /companies', () => {
    it('lista com os defaults declarados quando não há fields na URL', async () => {
      const { body } = await get('/companies').expect(200);

      expect(body.total).toBe(SEEDED_COMPANIES);
      expect(Object.keys(body.data[0]).sort()).toEqual([
        'cnpj',
        'id',
        'name',
        'uuid',
      ]);
    });

    it('trata % como caractere literal em like', async () => {
      // Aqui está a diferença mais silenciosa da v3: na v2 este `like`
      // devolveria as quatro empresas, porque `%` chegava ao SQL como coringa.
      // A biblioteca escapa o padrão e emite a cláusula ESCAPE, então a busca é
      // pelo texto "%" — que nenhum CNPJ contém.
      const { body } = await get('/companies?filter[cnpj][like]=%').expect(200);

      expect(body.total).toBe(0);
    });

    it('busca razão social pela coluna dobrada, independente da caixa', async () => {
      const [minusculas, maiusculas] = await Promise.all([
        get(`/companies?search=${encodeURIComponent('elétrico')}`).expect(200),
        get(`/companies?search=${encodeURIComponent('ELÉTRICO')}`).expect(200),
      ]);

      expect(minusculas.body.total).toBe(1);
      expect(maiusculas.body.total).toBe(minusculas.body.total);
    });
  });

  describe('GET /modules', () => {
    it('filtra por enum declarado', async () => {
      const { body } = await get('/modules?filter[status][eq]=active').expect(
        200,
      );

      expect(body.total).toBe(SEEDED_ACTIVE_MODULES);
    });

    it('recusa valor fora do enum antes de tocar no banco', async () => {
      const { body } = await get('/modules?filter[status][eq]=archived').expect(
        400,
      );

      expect(body.code).toBe('FILTER_VALUE_INVALID');
    });

    it('recusa ordenar por enum, que não tem ordem portável', async () => {
      // `status` é filtrável mas não ordenável: a ordem de um enum depende do
      // provider, então autorizá-la exigiria uma coluna de ordem portável.
      // `fields` e `sorts` são listas independentes na v3.
      const { body } = await get('/modules?sort=status').expect(400);

      expect(body.code).toBe('FIELD_NOT_ALLOWED');
      expect(body.details.scope).toBe('sort');
    });

    it('devolve todos os módulos com paginate=false, sem envelope', async () => {
      const { body } = await get('/modules?paginate=false').expect(200);

      expect(body.data).toHaveLength(SEEDED_MODULES);
      expect(body.total).toBeUndefined();
      expect(body.page).toBeUndefined();
    });
  });

  describe('GET /access-requests', () => {
    it('aninha a relação one com a projeção dela', async () => {
      const { body } = await get(
        '/access-requests?includes=user&fields=id,user.firstName&perPage=3',
      ).expect(200);

      expect(body.total).toBe(SEEDED_REQUESTS);
      expect(Object.keys(body.data[0]).sort()).toEqual(['id', 'user']);
      expect(Object.keys(body.data[0].user)).toEqual(['firstName']);
    });

    it('aninha a coleção e a relação dentro dela, contando roots', async () => {
      const { body } = await get(
        '/access-requests?includes=items,items.company&fields=id,items.status,items.company.name&perPage=' +
          SEEDED_REQUESTS,
      ).expect(200);

      // O ponto do assert é `total`: são 36 itens para 24 solicitações. Se o
      // count contasse linhas de join, este número seria 36. A coleção sai
      // como array e a relação dentro dela permanece aninhada — nunca
      // achatada em `items_company_name`.
      expect(body.total).toBe(SEEDED_REQUESTS);
      expect(body.data).toHaveLength(SEEDED_REQUESTS);

      const items = body.data[0].items;
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);
      expect(Object.keys(items[0]).sort()).toEqual(['company', 'status']);
      expect(Object.keys(items[0].company)).toEqual(['name']);
    });

    it('filtra por dentro da coleção sem inflar o total', async () => {
      // Path que cruza uma relação `many` vira subquery existencial ("alguma
      // solicitação tem item aprovado"), não join — por isso `total` continua
      // contando solicitações.
      const { body } = await get(
        '/access-requests?filter[items.status][eq]=approved&perPage=50',
      ).expect(200);

      expect(body.total).toBeGreaterThan(0);
      expect(body.total).toBeLessThanOrEqual(SEEDED_REQUESTS);
      expect(body.data).toHaveLength(body.total);
    });

    it('trata a whitelist de relação como exata', async () => {
      // A v2 olhava só o prefixo do path: autorizar `items.company` aceitava
      // `items.company.<qualquer-coluna>`. Aqui `updatedAt` não está em
      // `allowed`, e a projeção é recusada.
      const { body } = await get(
        '/access-requests?includes=items,items.company&fields=items.company.updatedAt',
      ).expect(400);

      expect(body.code).toBe('FIELD_NOT_ALLOWED');
    });

    it('exige o include pai para o include profundo', async () => {
      const { body } = await get(
        '/access-requests?includes=items.company',
      ).expect(400);

      expect(body.code).toBe('FIELD_NOT_ALLOWED');
      expect(body.details.scope).toBe('includes');
    });

    it('recusa ordenar através da coleção', async () => {
      // Autorizar isso é impossível: `defineQueryRules` recusa `items.status`
      // em `sorts` na construção. Do lado do cliente, o path simplesmente não
      // está na whitelist.
      const { body } = await get('/access-requests?sort=items.status').expect(
        400,
      );

      expect(body.code).toBe('FIELD_NOT_ALLOWED');
    });

    it('não devolve página curta quando a busca atravessa a coleção', async () => {
      // Duas regressões num teste só, e nenhuma delas dava erro:
      //
      // 1. até a `3.0.0`, alvo de `search` por relação `many` virava LEFT JOIN
      //    de predicado, o `LIMIT` incidia sobre linhas duplicadas pelo join e
      //    a página voltava **menor** que `perPage`, calada;
      // 2. `items.company.name` cruza duas relações, e cadeia existencial de
      //    mais de um salto era recusada pelo adapter TypeORM.
      //
      // `multi` casa duas das quatro empresas do seed, e os itens são
      // distribuídos em round-robin entre elas — então há roots com mais de um
      // item casando, que é a condição que produzia a duplicata.
      const { body } = await get(
        '/access-requests?search=multi&perPage=5',
      ).expect(200);

      expect(body.total).toBeGreaterThan(5);
      expect(body.data).toHaveLength(5);
      expect(new Set(body.data.map((row: { id: number }) => row.id)).size).toBe(
        5,
      );
    });

    it('busca por campo de relação one usando a coluna dobrada', async () => {
      const [minusculas, maiusculas] = await Promise.all([
        get(`/access-requests?search=${encodeURIComponent('cecília')}`).expect(
          200,
        ),
        get(`/access-requests?search=${encodeURIComponent('CECÍLIA')}`).expect(
          200,
        ),
      ]);

      expect(minusculas.body.total).toBe(2);
      expect(maiusculas.body.total).toBe(minusculas.body.total);
    });
  });
});
