import { DataSource, EntitySchema, type ObjectLiteral } from 'typeorm';
import { defineQueryRules, type CompiledQueryRules } from '@core/authorization';
import { foldText } from '@core/text-profile';
import { buildSchemaRegistry } from '@infra/adapters/typeorm';

/**
 * Formas de entidade que o corpus canônico deliberadamente **não** tem.
 *
 * O corpus existe para comparar as nove células da matriz, e cada caso novo
 * nele custa nove execuções; estas formas não mudam resultado observável em
 * nenhuma célula — elas exercitam ramos do adapter de referência que o modelo
 * canônico não alcança:
 *
 * - `ledger` tem **PK composta** e uma relação `many`, combinação que nenhum
 *   model do corpus tem: é o que faz a paginação em duas fases montar chaves
 *   de duas partes e a subquery existencial correlacionar por duas colunas.
 * - `entry` tem coluna anulável e coluna dobrada, o que dá `isNull` e `ilike`
 *   *dentro* de um filtro existencial.
 * - `article` declara colunas por construtor (`@Column()` sem `type`, a forma
 *   mais comum em app NestJS) e um enum portável, os dois caminhos de tipo que
 *   o corpus nunca produz porque fixa os tipos físicos por dialeto.
 * - `article.labels` é **many-to-many**: a única forma no repo cuja subquery
 *   existencial precisa atravessar uma **tabela de junção**, e a única que
 *   exercita os dois lados dela — `article.labels` é o lado dono, que guarda a
 *   junção, e `label.articles` é o inverso, que só a alcança pelo dono.
 * - `moment` tem **PK `datetime`**: o único tipo de chave cuja forma crua (a
 *   string do driver) e cuja forma hidratada (`Date`) não coincidem, o que
 *   expõe o limite da reordenação em memória da paginação.
 */

const ledger = new EntitySchema<ObjectLiteral>({
  name: 'ledger',
  tableName: 'ledgers',
  columns: {
    tenant_id: { type: 'integer', primary: true },
    code: { type: 'varchar', primary: true },
    title: { type: 'varchar' },
  },
  relations: {
    entries: { type: 'one-to-many', target: 'entry', inverseSide: 'ledger' },
  },
});

const entry = new EntitySchema<ObjectLiteral>({
  name: 'entry',
  tableName: 'entries',
  columns: {
    id: { type: 'integer', primary: true },
    ledger_tenant_id: { type: 'integer' },
    ledger_code: { type: 'varchar' },
    amount: { type: 'integer' },
    note: { type: 'varchar', nullable: true },
    label: { type: 'varchar' },
    label_folded: { type: 'varchar' },
  },
  relations: {
    ledger: {
      type: 'many-to-one',
      target: 'ledger',
      inverseSide: 'entries',
      nullable: false,
      // FK composta: é ela que produz duas colunas de correlação na subquery
      // existencial, onde o corpus só produz uma.
      joinColumn: [
        { name: 'ledger_tenant_id', referencedColumnName: 'tenant_id' },
        { name: 'ledger_code', referencedColumnName: 'code' },
      ],
    },
  },
});

const article = new EntitySchema<ObjectLiteral>({
  name: 'article',
  tableName: 'articles',
  columns: {
    // Construtores em vez de nome físico: é o que `@Column()` sem `type`
    // deixa na metadata do TypeORM, por reflexão.
    id: { type: Number, primary: true },
    title: { type: String },
    live: { type: Boolean },
    published_at: { type: Date },
    status: { type: 'simple-enum', enum: ['draft', 'review', 'published'] },
  },
  relations: {
    labels: { type: 'many-to-many', target: 'label', joinTable: true },
  },
});

const moment = new EntitySchema<ObjectLiteral>({
  name: 'moment',
  tableName: 'moments',
  columns: {
    at: { type: 'datetime', primary: true },
    name: { type: 'varchar' },
  },
  relations: {
    notes: { type: 'one-to-many', target: 'note', inverseSide: 'moment' },
  },
});

const note = new EntitySchema<ObjectLiteral>({
  name: 'note',
  tableName: 'notes',
  columns: {
    id: { type: 'integer', primary: true },
    moment_at: { type: 'datetime' },
    body: { type: 'varchar' },
  },
  relations: {
    moment: {
      type: 'many-to-one',
      target: 'moment',
      inverseSide: 'notes',
      nullable: false,
      joinColumn: { name: 'moment_at', referencedColumnName: 'at' },
    },
  },
});

const label = new EntitySchema<ObjectLiteral>({
  name: 'label',
  tableName: 'labels',
  columns: {
    id: { type: 'integer', primary: true },
    name: { type: 'varchar' },
    // Coluna dobrada: sem ela `labels.name` não pode ser alvo de `search`, e é
    // pela busca que se prova que a travessia da junção não é só do filtro.
    name_folded: { type: 'varchar' },
  },
  relations: {
    articles: {
      type: 'many-to-many',
      target: 'article',
      inverseSide: 'labels',
    },
  },
});

export const LOCAL_ENTITIES = { ledger, entry, article, label, moment, note };

let dataSource: DataSource | undefined;

export async function openLocalSqlite(): Promise<DataSource> {
  if (dataSource?.isInitialized) return dataSource;

  dataSource = new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    synchronize: true,
    entities: [ledger, entry, article, label, moment, note],
  });
  await dataSource.initialize();
  return dataSource;
}

export async function closeLocalSqlite(): Promise<void> {
  if (dataSource?.isInitialized) await dataSource.destroy();
  dataSource = undefined;
}

export function localRepository(
  entityName: keyof typeof LOCAL_ENTITIES
): ReturnType<DataSource['getRepository']> {
  return dataSource!.getRepository(LOCAL_ENTITIES[entityName]);
}

/**
 * Regras do `ledger` com todo o leque de operadores por relação `many`.
 *
 * As regras compartilhadas do corpus autorizam só `eq` e `ilike` em
 * `posts.title`, por escolha do corpus; aqui o alvo é o compilador, e cada
 * operador dentro do `EXISTS` tem forma de SQL própria a travar.
 *
 * São derivadas do registry que o **próprio resolver do adapter** produz, e não
 * de um schema escrito à mão: se o resolver errar a cardinalidade ou o
 * `foldedField`, estas regras nem compilam.
 */
export function ledgerRules(): CompiledQueryRules {
  const registry = buildSchemaRegistry(localRepository('ledger'));

  return defineQueryRules(registry, 'ledger', {
    filters: [
      { path: 'tenant_id', operators: ['eq'] },
      { path: 'entries', operators: ['isNull'] },
      { path: 'entries.note', operators: ['isNull'] },
      { path: 'entries.amount', operators: ['eq', 'in', 'notIn', 'between'] },
      // Cadeia de dois saltos, `many` e depois `one`, com **FK composta nos
      // dois**: é a única forma no repo em que o par de colunas aparece tanto
      // na correlação com o root quanto no `INNER JOIN` de dentro da
      // subquery. Que o segundo salto volte para `ledger` é irrelevante para o
      // compilador e conveniente para o fixture — o que se mede é a cadeia.
      { path: 'entries.ledger.title', operators: ['eq'] },
      {
        path: 'entries.label',
        operators: ['like', 'notLike', 'ilike', 'notIlike'],
      },
    ],
    sorts: ['code', 'tenant_id'],
    fields: {
      root: {
        allowed: ['tenant_id', 'code', 'title'],
        default: ['tenant_id', 'code', 'title'],
      },
      relations: {
        entries: {
          allowed: ['id', 'amount', 'note'],
          default: ['id', 'amount'],
        },
      },
    },
    includes: ['entries'],
    // `entries.label` também como alvo de busca: é a única forma no repo de
    // provar que o `search` existencial reusa a correlação por FK composta do
    // filtro, e não uma segunda implementação parecida.
    search: ['entries.label'],
  });
}

/**
 * Regras do `moment`, cuja PK é `datetime`.
 *
 * A ordenação é por `name` (varchar) de propósito: o que está em jogo é a PK
 * como *chave de página*, não como critério de ordem.
 */
export function momentRules(): CompiledQueryRules {
  const registry = buildSchemaRegistry(localRepository('moment'));

  return defineQueryRules(registry, 'moment', {
    filters: [{ path: 'name', operators: ['eq'] }],
    sorts: ['name'],
    fields: {
      root: { allowed: ['at', 'name'], default: ['at', 'name'] },
      relations: { notes: { allowed: ['id', 'body'], default: ['id'] } },
    },
    includes: ['notes'],
  });
}

/** Regras do `article`, para os tipos por construtor e o enum portável. */
export function articleRules(): CompiledQueryRules {
  const registry = buildSchemaRegistry(localRepository('article'));

  return defineQueryRules(registry, 'article', {
    filters: [
      { path: 'id', operators: ['eq'] },
      { path: 'labels.name', operators: ['eq'] },
    ],
    sorts: ['id'],
    fields: {
      root: {
        allowed: ['id', 'title', 'live', 'published_at', 'status'],
        default: ['id', 'title'],
      },
    },
    // `labels.name` também como alvo de busca, pela mesma razão que
    // `entries.label` é no `ledger`: filtro e busca compartilham a maquinaria
    // do `EXISTS`, e só um alvo existencial atravessando a junção prova que a
    // busca herdou a travessia em vez de reaprendê-la.
    search: ['labels.name'],
  });
}

/**
 * Regras do `label`: o **lado inverso** da many-to-many.
 *
 * O lado inverso não guarda `junctionEntityMetadata` nem as join columns — a
 * metadata do TypeORM só as registra no dono. Sem um root deste lado, a
 * travessia da junção ficaria provada numa direção só, e a outra emitiria SQL
 * contra a tabela errada sem nenhum teste notando.
 */
export function labelRules(): CompiledQueryRules {
  const registry = buildSchemaRegistry(localRepository('label'));

  return defineQueryRules(registry, 'label', {
    filters: [
      { path: 'id', operators: ['eq'] },
      { path: 'articles.title', operators: ['eq'] },
    ],
    sorts: ['id'],
    fields: { root: { allowed: ['id', 'name'], default: ['id', 'name'] } },
  });
}

/**
 * Semeia três `ledger` — dois do mesmo tenant, um sem nenhuma entry.
 *
 * O ledger sem entries é o que prova que a hidratação em duas fases devolve
 * array vazio em vez de derrubar o root; os dois do mesmo tenant são o que
 * torna a chave de página composta de fato ambígua na primeira parte.
 */
export async function seedLocal(): Promise<void> {
  await localRepository('ledger').insert([
    { tenant_id: 1, code: 'AAA', title: 'primeiro' },
    { tenant_id: 1, code: 'BBB', title: 'segundo' },
    { tenant_id: 2, code: 'AAA', title: 'terceiro' },
  ]);

  const entries = [
    {
      id: 1,
      ledger_tenant_id: 1,
      ledger_code: 'AAA',
      amount: 10,
      note: null,
      label: 'Ação',
    },
    {
      id: 2,
      ledger_tenant_id: 1,
      ledger_code: 'AAA',
      amount: 20,
      note: 'revisado',
      label: 'beta',
    },
    {
      id: 3,
      ledger_tenant_id: 1,
      ledger_code: 'BBB',
      amount: 30,
      note: 'revisado',
      label: 'gama',
    },
  ];

  await localRepository('entry').insert(
    entries.map((row) => ({ ...row, label_folded: foldText(row.label) }))
  );

  await seedLocalArticles();

  await localRepository('moment').insert([
    { at: new Date('2020-01-03T00:00:00Z'), name: 'ccc' },
    { at: new Date('2020-01-01T00:00:00Z'), name: 'aaa' },
    { at: new Date('2020-01-02T00:00:00Z'), name: 'bbb' },
  ]);
  await localRepository('note').insert([
    { id: 1, moment_at: new Date('2020-01-01T00:00:00Z'), body: 'primeira' },
    { id: 2, moment_at: new Date('2020-01-01T00:00:00Z'), body: 'segunda' },
  ]);
}

/**
 * Semeia a many-to-many: três artigos, dois rótulos e a tabela de junção.
 *
 * O artigo 1 carrega **os dois** rótulos e o 3 não carrega nenhum. É o que
 * torna observável a diferença entre `EXISTS` e join: com join, um termo que
 * casasse os dois rótulos devolveria o artigo 1 duas vezes e um `total` de 3;
 * o artigo sem rótulo é o lado oposto, o root que a subquery tem de excluir.
 *
 * A junção é preenchida por SQL cru porque ela não tem entidade própria — é
 * metadata sintetizada pelo TypeORM, e é justamente a tabela que a travessia
 * precisa alcançar.
 */
export async function seedLocalArticles(): Promise<void> {
  await localRepository('article').insert([
    {
      id: 1,
      title: 'Alpha',
      live: true,
      published_at: new Date('2020-01-01T00:00:00Z'),
      status: 'published',
    },
    {
      id: 2,
      title: 'Beta',
      live: true,
      published_at: new Date('2020-01-02T00:00:00Z'),
      status: 'draft',
    },
    {
      id: 3,
      title: 'Gama',
      live: false,
      published_at: new Date('2020-01-03T00:00:00Z'),
      status: 'review',
    },
  ]);

  await localRepository('label').insert(
    // Rótulos com prefixo comum: um único termo de busca casa os dois, que é o
    // que faz o artigo 1 casar duas vezes pela junção.
    [
      { id: 1, name: 'oss' },
      { id: 2, name: 'oss-core' },
    ].map((row) => ({ ...row, name_folded: foldText(row.name) }))
  );

  // Nome da junção e das duas colunas vêm da metadata, não da convenção de
  // nomes do TypeORM: se ela mudar, o seed acompanha e o teste continua
  // medindo a travessia, não o nome que alguém digitou aqui.
  const relation =
    localRepository('article').metadata.findRelationWithPropertyPath('labels')!;
  const table = relation.junctionEntityMetadata!.tableName;
  const toArticle = relation.joinColumns[0].databaseName;
  const toLabel = relation.inverseJoinColumns[0].databaseName;

  for (const [articleId, labelId] of [
    [1, 1],
    [1, 2],
    [2, 1],
  ]) {
    await dataSource!.query(
      `INSERT INTO "${table}" ("${toArticle}", "${toLabel}") VALUES (${articleId}, ${labelId})`
    );
  }
}
