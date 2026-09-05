import { CORPUS_CASES } from '../corpus/cases';
import {
  expectationFor,
  runCorpusCase,
  seedCorpus,
} from '../fixtures/corpus-runner';
import { openCell, selectedAdapter, type Cell } from './adapters';
import {
  assertProfile,
  openDialect,
  selectedDialect,
  type IntegrationContext,
} from './setup';

/**
 * Uma célula da matriz ORM × banco (spec §19).
 *
 * A célula é escolhida por `DQB_ADAPTER` mais `DQB_DIALECT` e a URL
 * correspondente. Sem elas o arquivo se declara pulado — skip local é
 * permitido, skip em CI não: o job `database-matrix` roda
 * `scripts/assert-no-skips.mjs` depois da suíte.
 *
 * O runner e as expectativas são os mesmos do dialeto de referência. É isso
 * que faz a matriz medir paridade em vez de medir nove suítes independentes,
 * cada uma livre de ser mais permissiva que as outras.
 */
const dialect = selectedDialect();
const adapter = selectedAdapter();

const describeCell = dialect ? describe : describe.skip;

describeCell(
  `corpus real — ${adapter} × ${dialect ?? 'sem célula selecionada'}`,
  () => {
    let context: IntegrationContext;
    let cell: Cell;

    beforeAll(async () => {
      context = await openDialect(dialect!);
      await assertProfile(context);

      // O seed é sempre do TypeORM, nas três células do mesmo dialeto: só
      // assim os bytes no banco são idênticos e a comparação mede os
      // compiladores, não os seeders.
      await seedCorpus(context.dataSource, context.entities);

      cell = await openCell(adapter, context);
    }, 180_000);

    afterAll(async () => {
      await cell?.close();
      await context?.dataSource.destroy();
    });

    it.each(CORPUS_CASES.map((testCase) => [testCase.id, testCase] as const))(
      '%s',
      async (_id, testCase) => {
        const expected = expectationFor(testCase, adapter, dialect!);
        const actual = await runCorpusCase(
          testCase,
          cell.sourceFor(testCase.rules)
        );

        if (expected.kind === 'error') {
          expect(actual).toEqual({
            kind: 'error',
            status: expected.status,
            code: expected.code,
          });
          return;
        }

        expect(actual.kind).toBe('rows');

        if (expected.ids !== undefined) {
          expect(actual.ids).toEqual(expected.ids);
        }
        if (expected.total !== undefined) {
          expect(actual.total).toBe(expected.total);
        }
        if (expected.lastPage !== undefined) {
          expect(actual.lastPage).toBe(expected.lastPage);
        }
        if (expected.firstRow !== undefined) {
          expect(actual.firstRow).toEqual(expected.firstRow);
        }
      },
      30_000
    );
  }
);
