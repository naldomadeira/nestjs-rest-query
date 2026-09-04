import type { DataSource } from 'typeorm';
import type { AnyQuerySource } from '@contracts/v3';
import { QueryBuilderService } from '@core/query-builder.v3.service';
import type {
  CorpusAdapterId,
  CorpusCase,
  CorpusExpectation,
} from '../corpus/corpus.types';
import { CORPUS_SEED } from '../corpus/seed';
import { RULES_PRESETS } from './rules';
import type { CorpusEntities } from './entity-schemas';

export interface CorpusOutcome {
  kind: 'rows' | 'error';
  ids?: (string | number)[];
  total?: number;
  lastPage?: number;
  firstRow?: Record<string, unknown>;
  status?: number;
  code?: string;
}

const service = new QueryBuilderService({});

/**
 * Expectativa que vale para este adapter (spec §5 e §24).
 *
 * É a canônica, salvo quando o caso declara uma divergência intencional para
 * ele. A divergente é comparada com o mesmo rigor, então um adapter que volte
 * a concordar com o canônico quebra o teste — e a divergência tem de sair.
 */
export function expectationFor(
  testCase: CorpusCase,
  adapter: CorpusAdapterId
): CorpusExpectation {
  return testCase.divergences?.[adapter]?.expect ?? testCase.expect;
}

/** Chave observável de um root: PK simples, ou partes unidas por `|`. */
function rootKey(
  row: Record<string, unknown>,
  primaryKey: readonly string[]
): string | number {
  if (primaryKey.length === 1) return row[primaryKey[0]] as string | number;
  return primaryKey.map((column) => String(row[column])).join('|');
}

/**
 * Roda um caso do corpus e reduz o resultado à forma comparável.
 *
 * Recebe a source pronta, não um repositório: é o que permite os três adapters
 * atravessarem exatamente o mesmo runner. A comparação entre ORMs e bancos
 * passa a ser de dados — não de comportamento reimplementado por adapter.
 */
export async function runCorpusCase(
  testCase: CorpusCase,
  source: AnyQuerySource
): Promise<CorpusOutcome> {
  const rules = RULES_PRESETS[testCase.rules];
  const primaryKey = rules.registry.get(rules.model)!.primaryKey;

  try {
    const result = await service.execute(source, testCase.query, rules);

    const rows = result.data as Record<string, unknown>[];
    // Sem linhas, a lista vazia é observável; com linhas, só se a projeção
    // expôs a chave inteira.
    const visible = new Set(Object.keys(rows[0] ?? {}));
    const idsObservable =
      rows.length === 0 || primaryKey.every((part) => visible.has(part));

    return {
      kind: 'rows',
      ids: idsObservable
        ? rows.map((row) => rootKey(row, primaryKey))
        : undefined,
      total: result.total,
      lastPage: result.lastPage,
      firstRow: rows[0],
    };
  } catch (error) {
    const response = (
      error as { getResponse?: () => { statusCode: number; code: string } }
    ).getResponse?.();

    if (!response) throw error;
    return { kind: 'error', status: response.statusCode, code: response.code };
  }
}

/**
 * Carrega o seed canônico.
 *
 * Insere pelo query builder, não por `save()`, para que os valores cheguem ao
 * banco exatamente como o corpus os declara — sem transformação de listener
 * nem coerção do repositório.
 */
export async function seedCorpus(
  dataSource: DataSource,
  entities: CorpusEntities
): Promise<void> {
  await dataSource.createQueryBuilder().delete().from(entities.tag).execute();
  await dataSource.createQueryBuilder().delete().from(entities.post).execute();
  await dataSource
    .createQueryBuilder()
    .update(entities.company)
    .set({ owner_id: null })
    .where('1 = 1')
    .execute();
  await dataSource.createQueryBuilder().delete().from(entities.user).execute();
  await dataSource
    .createQueryBuilder()
    .delete()
    .from(entities.company)
    .execute();

  await insert(
    dataSource,
    entities.company,
    CORPUS_SEED.companies.map(({ id, name, name_folded }) => ({
      id,
      name,
      name_folded,
      owner_id: null,
    }))
  );

  await insert(
    dataSource,
    entities.user,
    CORPUS_SEED.users.map((user) => ({
      ...user,
      score: user.score.toString(),
      // `balance` entra como literal SQL, não como parâmetro vinculado.
      //
      // O driver do SQL Server (tedious) escreve DECIMAL passando o valor por
      // `parseFloat` e serializando só 64 bits de mantissa — os 8 bytes altos
      // da forma de 16 bytes saem zerados. `decimal(38, 6)` acima de ~19
      // dígitos significativos nem chega ao banco (RangeError ao escrever), e
      // o que chega já perdeu precisão no `parseFloat`. Como literal, os bytes
      // gravados são exatamente os que o corpus declara — e são os mesmos nos
      // três bancos, que é a premissa do seed único.
      balance: () => user.balance,
      created_at: new Date(user.created_at),
    }))
  );

  // Os donos só podem ser ligados depois que os usuários existem.
  for (const company of CORPUS_SEED.companies) {
    await dataSource
      .createQueryBuilder()
      .update(entities.company)
      .set({ owner_id: company.owner_id })
      .where('id = :id', { id: company.id })
      .execute();
  }

  await insert(dataSource, entities.post, [...CORPUS_SEED.posts]);
  await insert(dataSource, entities.tag, [...CORPUS_SEED.tags]);
}

async function insert(
  dataSource: DataSource,
  entity: CorpusEntities[keyof CorpusEntities],
  rows: readonly object[]
): Promise<void> {
  if (rows.length === 0) return;
  await dataSource
    .createQueryBuilder()
    .insert()
    .into(entity as never)
    .values(rows as never)
    .execute();
}
