import { getTableColumns } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import {
  createDrizzleTable,
  type DrizzleRelationMap,
  type DrizzleTable,
} from 'nestjs-rest-query/drizzle';
import * as schema from './schema';

/**
 * Descritores **lógicos** das tabelas — o que a v3 realmente consome.
 *
 * A v3 não inspeciona o ORM: o schema lógico é declarado, e é ele que decide
 * tipo do valor, nulabilidade, quais colunas são internas, qual coluna dobrada
 * apoia `search`/`ilike` e qual coluna dá ordem total portável. Se um descritor
 * declarar campo que a tabela não tem, a query sai com uma coluna inexistente e
 * o Postgres reclama — por isso `assertPhysicalSchemaMatches` roda no load
 * deste módulo e transforma a divergência em erro de inicialização.
 *
 * Cada campo tem **dois nomes**, e os dois importam. A chave (`companyId`) é o
 * campo lógico: é o que a API expõe, o que as regras autorizam e o que aparece
 * em `fields=`. O `name` (`company_id`) é a coluna física, e é o único que vai
 * ao SQL. Nada obriga as duas convenções a coincidirem — é por isso que a API
 * pode ser camelCase sobre um banco snake_case sem uma camada de tradução na
 * aplicação.
 *
 * `kind` é a decisão mais consequente aqui. `uuid` não é `string`: ele proíbe
 * `gt`/`lt`/`between` sem `portableOrderField` e recusa valor que não seja um
 * UUID canônico, em vez de comparar texto arbitrário.
 */

export const companiesTable: DrizzleTable = createDrizzleTable({
  name: 'companies',
  model: 'company',
  columns: {
    id: {
      name: 'id',
      kind: 'uuid',
      nullable: false,
      primaryKey: true,
      portableOrderField: 'idOrder',
    },
    idOrder: {
      name: 'id_order',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      internal: true,
    },
    name: {
      name: 'name',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      foldedField: 'nameFolded',
    },
    nameFolded: {
      name: 'name_folded',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      internal: true,
    },
    createdAt: {
      name: 'created_at',
      kind: 'datetime',
      nullable: false,
      primaryKey: false,
    },
  },
});

export const usersTable: DrizzleTable = createDrizzleTable({
  name: 'users',
  model: 'user',
  columns: {
    id: {
      name: 'id',
      kind: 'uuid',
      nullable: false,
      primaryKey: true,
      portableOrderField: 'idOrder',
    },
    idOrder: {
      name: 'id_order',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      internal: true,
    },
    name: {
      name: 'name',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      foldedField: 'nameFolded',
    },
    nameFolded: {
      name: 'name_folded',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      internal: true,
    },
    email: {
      name: 'email',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      foldedField: 'emailFolded',
    },
    emailFolded: {
      name: 'email_folded',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      internal: true,
    },
    companyId: {
      name: 'company_id',
      kind: 'uuid',
      nullable: true,
      primaryKey: false,
    },
    createdAt: {
      name: 'created_at',
      kind: 'datetime',
      nullable: false,
      primaryKey: false,
    },
  },
});

export const postsTable: DrizzleTable = createDrizzleTable({
  name: 'posts',
  model: 'post',
  columns: {
    id: {
      name: 'id',
      kind: 'uuid',
      nullable: false,
      primaryKey: true,
      portableOrderField: 'idOrder',
    },
    idOrder: {
      name: 'id_order',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      internal: true,
    },
    title: {
      name: 'title',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      foldedField: 'titleFolded',
    },
    titleFolded: {
      name: 'title_folded',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      internal: true,
    },
    content: {
      name: 'content',
      kind: 'string',
      nullable: true,
      primaryKey: false,
    },
    userId: {
      name: 'user_id',
      kind: 'uuid',
      nullable: false,
      primaryKey: false,
    },
    createdAt: {
      name: 'created_at',
      kind: 'datetime',
      nullable: false,
      primaryKey: false,
    },
  },
});

/**
 * Relações a partir de `user`, por **path pontuado**.
 *
 * A chave é o path visto do root: `company` é um salto, e `company.users`
 * seria o salto seguinte. Só as chaves sem ponto entram no schema lógico do
 * root; as pontuadas existem para o compilador saber juntar ou correlacionar
 * caminhos profundos.
 *
 * `sourceColumn`/`targetColumn` são as colunas da junção, na direção do path —
 * e não a FK "de verdade": em `posts` (many) o root entra com `id` e o alvo
 * com `userId`, o inverso de `company`.
 */
export const userRelations: DrizzleRelationMap = {
  company: {
    target: companiesTable,
    cardinality: 'one',
    // `companyId` é nullable, então a relação também é: o LEFT JOIN sem
    // correspondência vira `company: null`, não um objeto de nulos.
    nullable: true,
    sourceColumn: 'companyId',
    targetColumn: 'id',
  },
  posts: {
    target: postsTable,
    cardinality: 'many',
    nullable: true,
    sourceColumn: 'id',
    targetColumn: 'userId',
  },
};

/** Coleção de primeiro nível: suportada. `company.users` não seria. */
export const companyRelations: DrizzleRelationMap = {
  users: {
    target: usersTable,
    cardinality: 'many',
    nullable: true,
    sourceColumn: 'id',
    targetColumn: 'companyId',
  },
};

export const postRelations: DrizzleRelationMap = {
  user: {
    target: usersTable,
    cardinality: 'one',
    // `posts.userId` é NOT NULL: declarar `true` aqui faria o schema lógico
    // divergir do físico e mentiria sobre a possibilidade de `null` no JSON.
    nullable: false,
    sourceColumn: 'userId',
    targetColumn: 'id',
  },
};

/**
 * Descritor lógico versus tabela física, conferido no load do módulo.
 *
 * Existem duas declarações da mesma tabela neste exemplo porque a biblioteca
 * não deriva `DrizzleTable` de um `pgTable`. Sem esta verificação, um
 * `name_folded` renomeado no `pgTable` só apareceria como
 * `column "name_folded" does not exist` na primeira busca em produção; com
 * ela, a aplicação não sobe.
 *
 * O que se compara agora é o par inteiro: a **chave** do descritor tem de ser
 * a propriedade do `pgTable` (as duas são o campo lógico, e é por elas que o
 * `fields=` e o JSON andam) e o `name` do descritor tem de ser a coluna física
 * daquela propriedade. Antes do PR5 esta função exigia uma terceira coisa —
 * que os dois nomes fossem iguais entre si —, porque o compilador emitia a
 * chave e ignorava `name`. Aquela exigência sumiu com o defeito.
 */
function assertPhysicalSchemaMatches(
  descriptor: DrizzleTable,
  table: PgTable
): void {
  const physical: Record<string, { name: string }> = getTableColumns(table);

  for (const [path, column] of Object.entries(descriptor.columns)) {
    const actual = physical[path];

    if (!actual) {
      throw new Error(
        `${descriptor.name}: campo lógico "${path}" não existe no pgTable`
      );
    }

    if (actual.name !== column.name) {
      throw new Error(
        `${descriptor.name}: campo lógico "${path}" mapeia a coluna física ` +
          `"${actual.name}" no pgTable, mas o descritor declara ` +
          `"${column.name}"; é o descritor que vai ao SQL`
      );
    }
  }

  for (const path of Object.keys(physical)) {
    if (descriptor.columns[path]) continue;
    throw new Error(
      `${descriptor.name}: coluna física "${path}" não foi declarada no ` +
        `descritor lógico; um campo não declarado é invisível para a v3`
    );
  }
}

assertPhysicalSchemaMatches(companiesTable, schema.companies);
assertPhysicalSchemaMatches(usersTable, schema.users);
assertPhysicalSchemaMatches(postsTable, schema.posts);
