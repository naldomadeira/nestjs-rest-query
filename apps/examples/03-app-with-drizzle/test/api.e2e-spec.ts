import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';

/**
 * Smoke E2E do exemplo Drizzle (gate da §23).
 *
 * Não é a suíte de paridade — essa é a matriz de nove células. O que este
 * arquivo prova é outra coisa, e nenhuma outra suíte prova: que a API pública
 * v3 é utilizável **de fora**, por um app NestJS real, contra um Postgres real,
 * pelo caminho documentado. Foi compilando exemplos com `strict` que apareceu a
 * `DynamicQueryDto` não atribuível ao próprio `execute()`.
 *
 * O banco é preparado e limpo aqui: sem isso o teste mediria o que o
 * desenvolvedor deixou em disco. Requer o Postgres do `docker-compose.yml`
 * (porta 5433).
 */
describe('API v3 sobre Drizzle + Postgres', () => {
  let app: NestExpressApplication;
  let admin: Awaited<ReturnType<typeof openAdmin>>;

  /** Conexão própria do teste, separada do pool que a aplicação abre. */
  async function openAdmin() {
    const { createDatabase } = await import('../src/db/database.module');
    return createDatabase();
  }

  beforeAll(async () => {
    admin = await openAdmin();

    const { resetDatabase } = await import('../src/database/bootstrap');
    await resetDatabase(admin);

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
    await app.init();
  }, 120_000);

  afterAll(async () => {
    // `close()` dispara o shutdown hook do `DatabaseModule`, que encerra o pool
    // da aplicação; o do teste é encerrado à mão depois de derrubar o schema.
    await app?.close();

    if (admin) {
      const { dropSchema } = await import('../src/database/bootstrap');
      await dropSchema(admin);
      await admin.$client.end();
    }
  }, 60_000);

  const get = (path: string) => request(app.getHttpServer()).get(path);

  describe('envelope e paginação', () => {
    it('devolve o envelope canônico', async () => {
      const { body } = await get('/users?perPage=5').expect(200);

      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBe(5);
      expect(body.page).toBe(1);
      expect(body.perPage).toBe(5);
      // 15 usuários com empresa + 2 órfãos.
      expect(body.total).toBe(17);
      expect(body.lastPage).toBe(4);
    });

    it('devolve só `data` quando a paginação é desligada', async () => {
      const { body } = await get('/companies?paginate=false').expect(200);

      expect(Object.keys(body)).toEqual(['data']);
      expect(body.data.length).toBe(5);
    });

    it('conta roots, não linhas de junção', async () => {
      // A coleção `users` sai do statement principal e é hidratada por
      // consulta própria; se ela fosse juntada, `total` viraria 17.
      const { body } = await get('/companies?includes=users').expect(200);

      expect(body.total).toBe(5);
      expect(body.data).toHaveLength(5);
    });
  });

  describe('projeção', () => {
    it('projeta exatamente os campos pedidos', async () => {
      const { body } = await get('/users?fields=id,name&perPage=1').expect(200);

      // As colunas internas (`nameFolded`, `emailFolded`, `idOrder`) não
      // aparecem no JSON nem quando o campo que elas apoiam é projetado.
      expect(Object.keys(body.data[0]).sort()).toEqual(['id', 'name']);
    });

    it('aninha a relação `one` com a projeção dela', async () => {
      const { body } = await get(
        '/posts?includes=user&fields=id,user.name&perPage=1'
      ).expect(200);

      expect(Object.keys(body.data[0]).sort()).toEqual(['id', 'user']);
      expect(Object.keys(body.data[0].user)).toEqual(['name']);
      expect(typeof body.data[0].user.name).toBe('string');
    });

    it('devolve `null` na relação `one` nulável sem correspondência', async () => {
      const { body } = await get(
        '/users?includes=company&fields=id,name,company.name&filter[company][isNull]=true'
      ).expect(200);

      expect(body.total).toBe(2);
      for (const row of body.data) expect(row.company).toBeNull();
    });

    it('hidrata a coleção de primeiro nível com a projeção aninhada', async () => {
      const { body } = await get(
        '/companies?includes=users&fields=id,users.name&perPage=1'
      ).expect(200);

      const [company] = body.data;
      expect(Object.keys(company).sort()).toEqual(['id', 'users']);
      expect(Array.isArray(company.users)).toBe(true);
      expect(company.users).toHaveLength(3);
      for (const user of company.users) {
        expect(Object.keys(user)).toEqual(['name']);
      }
    });
  });

  describe('whitelist exata', () => {
    it('recusa campo de relação fora da whitelist, sem tocar no banco', async () => {
      const { body } = await get(
        '/users?includes=company&fields=id,company.createdAt'
      ).expect(400);

      expect(body.code).toBe('FIELD_NOT_ALLOWED');
      // `details` descreve o path recusado e nunca carrega valor do cliente.
      expect(body.details.path).toBe('company.createdAt');
    });

    it('não expõe a coluna dobrada como campo', async () => {
      const { body } = await get('/users?fields=id,nameFolded').expect(400);

      expect(['FIELD_NOT_ALLOWED', 'FIELD_NOT_FOUND']).toContain(body.code);
    });

    it('recusa operador que o campo não autoriza', async () => {
      // `id` declara apenas `eq` e `in`.
      const { body } = await get(
        '/users?filter[id][gt]=0a0a0a0a-0000-4000-8000-000000000001'
      ).expect(400);

      expect(body.code).toBe('OPERATOR_NOT_ALLOWED');
    });

    it('recusa valor que não é do tipo do campo', async () => {
      // `id` é `uuid`: não há coerção pelo formato do texto.
      const { body } = await get('/users?filter[id][eq]=nao-e-uuid').expect(
        400
      );

      expect(body.code).toBe('FILTER_VALUE_INVALID');
    });
  });

  describe('busca pelo valor dobrado', () => {
    /**
     * A dobra do perfil `portable-strict` é `NFC` + `toLowerCase`: normaliza a
     * caixa e **não** remove diacrítico. Então o que a busca promete é que a
     * *caixa* do termo não muda o conjunto devolvido — em qualquer banco e
     * qualquer collation, sem `ILIKE`.
     */
    it('a caixa do termo não muda o total (coluna do root)', async () => {
      const minusculas = await get('/companies?search=elétrica').expect(200);
      const maiusculas = await get('/companies?search=ELÉTRICA').expect(200);

      expect(minusculas.body.total).toBe(3);
      expect(maiusculas.body.total).toBe(minusculas.body.total);
    });

    it('a caixa do termo não muda o total (coluna através de relação)', async () => {
      // `search` do endpoint de usuários cobre `company.name`: os 9 usuários
      // das três empresas "Elétrica".
      const minusculas = await get('/users?search=elétrica&perPage=50').expect(
        200
      );
      const maiusculas = await get('/users?search=ELÉTRICA&perPage=50').expect(
        200
      );

      expect(minusculas.body.total).toBe(9);
      expect(maiusculas.body.total).toBe(minusculas.body.total);
    });

    it('o diacrítico continua significativo', async () => {
      // Dobrar não é remover acento: "eletrica" sem acento não acha nada nos
      // nomes das empresas. É o contrato, não uma limitação escondida.
      const semAcento = await get('/companies?search=eletrica').expect(200);

      expect(semAcento.body.total).toBe(0);
    });
  });

  describe('padrão literal e ordenação', () => {
    it('trata `%` como texto em `like`', async () => {
      const { body } = await get('/posts?filter[title][like]=100%').expect(200);

      // Nenhum título contém "100%", e `%` não é coringa: zero linhas em vez
      // de tudo.
      expect(body.total).toBe(0);
    });

    it('ordena pela coluna pedida e anexa a PK como desempate', async () => {
      const { body } = await get(
        '/companies?sort=name&fields=id,name&paginate=false'
      ).expect(200);

      const nomes = body.data.map((row: { name: string }) => row.name);
      expect(nomes).toEqual([...nomes].sort());
    });

    it('recusa ordenação através de relação `many`', async () => {
      const { body } = await get('/companies?sort=users.name').expect(400);

      expect(body.code).toBe('FIELD_NOT_ALLOWED');
    });
  });
});
