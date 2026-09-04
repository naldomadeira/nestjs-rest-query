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
      name: 'idOrder',
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
      name: 'nameFolded',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      internal: true,
    },
    createdAt: {
      name: 'createdAt',
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
      name: 'idOrder',
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
      name: 'nameFolded',
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
      name: 'emailFolded',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      internal: true,
    },
    companyId: {
      name: 'companyId',
      kind: 'uuid',
      nullable: true,
      primaryKey: false,
    },
    createdAt: {
      name: 'createdAt',
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
      name: 'idOrder',
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
      name: 'titleFolded',
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
      name: 'userId',
      kind: 'uuid',
      nullable: false,
      primaryKey: false,
    },
    createdAt: {
      name: 'createdAt',
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
 * `nameFolded` renomeado só apareceria como `column "nameFolded" does not
 * exist` na primeira busca em produção; com ela, a aplicação não sobe.
 *
 * A igualdade exigida é `chave lógica === nome físico`, e não
 * `descritor.name === nome físico`: é a chave que o compilador SQL emite como
 * identificador — `DrizzleColumn.name` não é lido em lugar nenhum.
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

    if (actual.name !== path) {
      throw new Error(
        `${descriptor.name}: campo lógico "${path}" mapeia a coluna física ` +
          `"${actual.name}"; o compilador Drizzle emite a chave lógica como ` +
          `identificador, então os dois nomes precisam coincidir`
      );
    }

    if (column.name !== path) {
      throw new Error(
        `${descriptor.name}: descritor de "${path}" declara name ` +
          `"${column.name}"; esse campo é ignorado pelo compilador e ` +
          `divergir dele só engana quem lê`
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
