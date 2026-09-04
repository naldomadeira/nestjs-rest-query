import type { CompiledQueryRules } from '@core/authorization';
import { buildQueryPlan } from '@core/query-plan';
import { normalizeResult } from '@core/result-normalizer';
import { compilePlan, executeCompiled } from '@infra/adapters/typeorm';
import { ESCAPE_CHARACTER } from './helpers';
import {
  closeLocalSqlite,
  ledgerRules,
  localRepository,
  momentRules,
  openLocalSqlite,
  seedLocal,
} from './local-schemas';

beforeAll(async () => {
  await openLocalSqlite();
  await seedLocal();
}, 60_000);
afterAll(closeLocalSqlite);

interface Outcome {
  queryCount: number;
  total?: number;
  lastPage?: number;
  data: Record<string, unknown>[];
}

async function runOn(
  entity: 'ledger' | 'moment',
  rules: CompiledQueryRules,
  query: Record<string, unknown>
): Promise<Outcome> {
  const plan = buildQueryPlan(query, rules);
  const compiled = compilePlan(plan, localRepository(entity), ESCAPE_CHARACTER);
  const result = await executeCompiled(compiled);
  const normalized = normalizeResult<Record<string, unknown>>(
    result.rows,
    result.total,
    plan
  );

  return {
    queryCount: result.queryCount!,
    total: normalized.total,
    lastPage: normalized.lastPage,
    data: normalized.data,
  };
}

const run = (query: Record<string, unknown>): Promise<Outcome> =>
  runOn('ledger', ledgerRules(), query);

/** Chave observável de um root de PK composta. */
const keysOf = (rows: Record<string, unknown>[]): string[] =>
  rows.map((row) => `${row.tenant_id}|${row.code}`);

/**
 * Paginação em duas fases com **PK composta**.
 *
 * Nenhum model do corpus junta as duas coisas — PK de duas colunas e relação
 * `many` na projeção — e é justamente o cruzamento que exercita o caminho
 * inteiro: a fase 1 tem de projetar as duas colunas de chave, a fase 2 tem de
 * restringir por `(a = ? AND b = ?) OR (...)` em vez de `IN`, e a reordenação
 * em memória tem de comparar chaves de duas partes.
 */
describe('paginação em duas fases com PK composta', () => {
  it('conta roots distintos e pagina por chave inteira', async () => {
    const result = await run({ includes: 'entries', perPage: '2', page: '1' });

    expect(result.queryCount).toBe(3);
    expect(result.total).toBe(3);
    expect(result.lastPage).toBe(2);
    expect(keysOf(result.data)).toEqual(['1|AAA', '1|BBB']);
  });

  it('a segunda página continua de onde a primeira parou, sem repetir root', async () => {
    // Duas partes de chave com a primeira repetida (tenant 1 duas vezes) é o
    // cenário em que uma chave truncada faria a página 2 repetir `1|BBB`.
    const first = await run({ includes: 'entries', perPage: '2', page: '1' });
    const second = await run({ includes: 'entries', perPage: '2', page: '2' });

    expect(keysOf(second.data)).toEqual(['2|AAA']);
    expect(new Set([...keysOf(first.data), ...keysOf(second.data)]).size).toBe(
      3
    );
  });

  it('a fase 2 reimpõe a ordem escolhida pela fase 1', async () => {
    // Duas coisas garantem a ordem aqui: o clone de hidratação herda o ORDER BY
    // do plano, e a reordenação em memória o reimpõe por chave composta. A
    // segunda existe para não depender do plano do banco na query com join — e
    // é ela que precisa comparar `tenant_id` e `code` juntos, porque só
    // `tenant_id` empataria os dois ledgers do tenant 1.
    const result = await run({ includes: 'entries', sort: '-code' });
    expect(keysOf(result.data)).toEqual(['1|BBB', '1|AAA', '2|AAA']);
  });

  it('hidrata a relação many de cada root, sem misturar tenants', async () => {
    // A FK composta é a parte frágil: correlacionar só por `tenant_id` daria as
    // entries de `1|BBB` também a `1|AAA`. O root sem itens fecha o outro lado
    // — ele tem de sobreviver à hidratação com coleção vazia, que é a diferença
    // entre LEFT JOIN e INNER JOIN na fase 2.
    const result = await run({ includes: 'entries', sort: 'code,tenant_id' });

    expect(result.data).toEqual([
      {
        tenant_id: 1,
        code: 'AAA',
        title: 'primeiro',
        entries: [
          { id: 1, amount: 10 },
          { id: 2, amount: 20 },
        ],
      },
      { tenant_id: 2, code: 'AAA', title: 'terceiro', entries: [] },
      {
        tenant_id: 1,
        code: 'BBB',
        title: 'segundo',
        entries: [{ id: 3, amount: 30 }],
      },
    ]);
  });

  it('filtro existencial e projeção many convivem no mesmo plano', async () => {
    // O filtro vira EXISTS (não infla o root) e o include vira LEFT JOIN (não
    // entra no count): `total` tem de contar os dois ledgers do tenant 1 que
    // têm alguma entry, não as linhas de join.
    const result = await run({
      includes: 'entries',
      filter: { 'entries.amount': { in: '10,30' } },
    });

    expect(result.total).toBe(2);
    expect(keysOf(result.data)).toEqual(['1|AAA', '1|BBB']);
    // O EXISTS filtra o root, não a coleção: `1|AAA` volta com as duas entries,
    // inclusive a de valor 20, que não está na lista do filtro.
    expect(result.data[0].entries).toEqual([
      { id: 1, amount: 10 },
      { id: 2, amount: 20 },
    ]);
  });
});

describe('paginação em duas fases com PK cuja forma crua difere da hidratada', () => {
  it('mantém a ordem da página com PK datetime', async () => {
    // A fase 1 lê as chaves por `getRawMany`, então a PK chega como a string do
    // driver (`2020-01-01 00:00:00.000`); a fase 2 hidrata e a mesma PK vira
    // `Date`. As duas formas não coincidem por `String(...)`, então a
    // reordenação em memória não consegue ranquear nenhuma linha e degenera em
    // `sort` estável — a ordem que sobra é a da query de hidratação, que carrega
    // o mesmo ORDER BY do plano e por isso ainda é a ordem correta.
    //
    // O teste trava o observável (a ordem) e delimita a rede de segurança: se a
    // reordenação em memória algum dia passar a ser o mecanismo principal — por
    // exemplo, se a hidratação deixar de repetir o ORDER BY —, este caso precisa
    // de normalização real de chave antes, e é aqui que ele vai falhar.
    const result = await runOn('moment', momentRules(), {
      includes: 'notes',
      sort: '-name',
      perPage: '2',
    });

    expect(result.queryCount).toBe(3);
    expect(result.total).toBe(3);
    expect(result.data.map((row) => row.name)).toEqual(['ccc', 'bbb']);
  });

  it('hidrata a relação many de um root de PK datetime', async () => {
    const result = await runOn('moment', momentRules(), {
      includes: 'notes',
      filter: { name: { eq: 'aaa' } },
    });

    expect(result.data[0].notes).toEqual([{ id: 1 }, { id: 2 }]);
  });
});
