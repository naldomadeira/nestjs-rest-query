import type { DataSource } from 'typeorm';
import { buildSchemaRegistry } from '@infra/adapters/typeorm';
import { closeSqlite, corpusEntities, openSqlite } from './helpers';
import {
  closeLocalSqlite,
  localRepository,
  openLocalSqlite,
} from './local-schemas';

let dataSource: DataSource;

beforeAll(async () => {
  dataSource = await openSqlite();
});

afterAll(closeSqlite);

const UserEntity = () => corpusEntities().user;
const PostEntity = () => corpusEntities().post;
const TagEntity = () => corpusEntities().tag;

describe('buildSchemaRegistry', () => {
  it('mapeia colunas físicas para ScalarKind', () => {
    const schema = buildSchemaRegistry(
      dataSource.getRepository(UserEntity())
    ).get('user')!;

    expect(schema.fields.get('id')?.kind).toBe('integer');
    expect(schema.fields.get('name')?.kind).toBe('string');
    expect(schema.fields.get('score')?.kind).toBe('bigint');
    expect(schema.fields.get('balance')?.kind).toBe('decimal');
    expect(schema.fields.get('active')?.kind).toBe('boolean');
    expect(schema.fields.get('born_on')?.kind).toBe('date');
    expect(schema.fields.get('created_at')?.kind).toBe('datetime');
  });

  it('descobre PK simples e composta', () => {
    expect(
      buildSchemaRegistry(dataSource.getRepository(UserEntity())).get('user')
        ?.primaryKey
    ).toEqual(['id']);
    expect(
      buildSchemaRegistry(dataSource.getRepository(TagEntity())).get('tag')
        ?.primaryKey
    ).toEqual(['post_id', 'label']);
  });

  it('mapeia cardinalidade das relações', () => {
    const schema = buildSchemaRegistry(
      dataSource.getRepository(UserEntity())
    ).get('user')!;

    expect(schema.relations.get('company')?.cardinality).toBe('one');
    expect(schema.relations.get('company')?.target).toBe('company');
    expect(schema.relations.get('posts')?.cardinality).toBe('many');
    expect(schema.relations.get('posts')?.target).toBe('post');
  });

  it('inclui todos os schemas alcançáveis por relação', () => {
    const registry = buildSchemaRegistry(
      dataSource.getRepository(UserEntity())
    );
    expect([...registry.keys()].sort()).toEqual([
      'company',
      'post',
      'tag',
      'user',
    ]);
  });

  it('marca colunas folded e portableOrder como internas', () => {
    const schema = buildSchemaRegistry(
      dataSource.getRepository(UserEntity())
    ).get('user')!;

    expect(schema.fields.get('name_folded')?.internal).toBe(true);
    expect(schema.fields.get('email_folded')?.internal).toBe(true);
    expect(schema.fields.get('name')?.foldedField).toBe('name_folded');
    expect(schema.fields.get('email')?.foldedField).toBe('email_folded');
  });

  it('liga o portableOrderField ao campo uuid correspondente', () => {
    // MySQL e SQLite não têm tipo UUID nativo, então o tipo lógico vem de uma
    // declaração explícita — a extensão de schema do spec §9.
    const registry = buildSchemaRegistry(
      dataSource.getRepository(PostEntity()),
      { fieldKinds: { post: { id: 'uuid' } } }
    );
    const post = registry.get('post')!;

    expect(post.fields.get('id')?.kind).toBe('uuid');
    expect(post.fields.get('id')?.portableOrderField).toBe('id_order');
    expect(post.fields.get('id_order')?.internal).toBe(true);
  });

  it('sem declaração explícita, char(36) permanece string', () => {
    const post = buildSchemaRegistry(
      dataSource.getRepository(PostEntity())
    ).get('post')!;
    expect(post.fields.get('id')?.kind).toBe('string');
  });

  it('liga o portableOrderField numa PK composta', () => {
    const tag = buildSchemaRegistry(dataSource.getRepository(TagEntity())).get(
      'tag'
    )!;
    expect(tag.fields.get('post_id')?.portableOrderField).toBe('post_id_order');
  });

  it('marca colunas nuláveis corretamente', () => {
    const schema = buildSchemaRegistry(
      dataSource.getRepository(UserEntity())
    ).get('user')!;
    expect(schema.fields.get('nickname')?.nullable).toBe(true);
    expect(schema.fields.get('name')?.nullable).toBe(false);
  });

  it('produz o mesmo shape que o schema canônico do corpus', () => {
    const registry = buildSchemaRegistry(
      dataSource.getRepository(UserEntity())
    );
    const user = registry.get('user')!;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { CORPUS_SCHEMAS } = require('../../fixtures/schemas');
    const canonical = CORPUS_SCHEMAS.get('user');

    expect([...user.fields.keys()].sort()).toEqual(
      [...canonical.fields.keys()].sort()
    );
    for (const [path, field] of canonical.fields) {
      expect([path, user.fields.get(path)?.kind]).toEqual([path, field.kind]);
    }
  });

  it('recusa coluna de tipo desconhecido em vez de tratar como string', () => {
    const repository = dataSource.getRepository(UserEntity());
    const column = repository.metadata.columns.find(
      (c) => c.propertyName === 'zip'
    )!;
    const original = column.type;
    (column as { type: unknown }).type = 'geography';

    try {
      expect(() => buildSchemaRegistry(repository)).toThrow(
        expect.objectContaining({ code: 'SOURCE_CONFIGURATION_INVALID' })
      );
    } finally {
      (column as { type: unknown }).type = original;
    }
  });
});

/**
 * Formas de declaração que o corpus não produz.
 *
 * O corpus fixa o tipo físico de cada coluna por dialeto, porque é o que torna
 * as nove células comparáveis — e por isso ele nunca exercita as duas formas
 * mais comuns em app real: `@Column()` sem `type`, que chega como construtor
 * refletido, e o enum portável do TypeORM.
 */
describe('buildSchemaRegistry sobre declarações não canônicas', () => {
  beforeAll(async () => {
    await openLocalSqlite();
  });
  afterAll(closeLocalSqlite);

  it('resolve colunas declaradas por construtor', () => {
    // `@Column()` sem `type` deixa o construtor da propriedade na metadata.
    // Tratá-lo como desconhecido faria o resolver recusar toda entidade escrita
    // do jeito idiomático do NestJS; tratá-lo como `string` por omissão traria
    // de volta a coerção errada da v2.
    const article = buildSchemaRegistry(localRepository('article')).get(
      'article'
    )!;

    expect(article.fields.get('id')?.kind).toBe('integer');
    expect(article.fields.get('title')?.kind).toBe('string');
    expect(article.fields.get('live')?.kind).toBe('boolean');
    // `Date` é instante, não data civil: o construtor não distingue os dois, e
    // o lado seguro é o que carrega hora.
    expect(article.fields.get('published_at')?.kind).toBe('datetime');
  });

  it('mapeia o enum portável do TypeORM e preserva os valores declarados', () => {
    // `simple-enum` é o nome que o TypeORM dá ao enum portável (varchar +
    // CHECK) e o único que ele aceita no SQLite; sem ele no mapa, uma entidade
    // com enum portável fazia o registry inteiro falhar como tipo não mapeado.
    const article = buildSchemaRegistry(localRepository('article')).get(
      'article'
    )!;
    const status = article.fields.get('status')!;

    expect(status.kind).toBe('enum');
    expect(status.enumValues).toEqual(['draft', 'review', 'published']);
  });

  it('descreve a cardinalidade many-to-many como many', () => {
    // O planner e o compilador dependem disso para não juntar a relação: com
    // cardinalidade `many`, o caminho vira `EXISTS` e a travessia da tabela de
    // junção acontece depois, no compilador.
    const article = buildSchemaRegistry(localRepository('article')).get(
      'article'
    )!;
    expect(article.relations.get('labels')?.cardinality).toBe('many');
  });

  it('descobre PK composta e a FK composta que a referencia', () => {
    const registry = buildSchemaRegistry(localRepository('ledger'));

    expect(registry.get('ledger')?.primaryKey).toEqual(['tenant_id', 'code']);
    expect(registry.get('ledger')?.relations.get('entries')?.cardinality).toBe(
      'many'
    );
    expect(registry.get('entry')?.fields.get('note')?.nullable).toBe(true);
  });
});
