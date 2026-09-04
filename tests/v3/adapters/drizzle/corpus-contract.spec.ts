import { CORPUS_CASES } from '../../corpus/cases';
import { runCorpusCase } from '../../fixtures/corpus-runner';
import { closeSqlite, openSqlite, sourceFor } from './helpers';

/**
 * Contract test do corpus contra o adapter Drizzle.
 *
 * Mesmos casos, mesmo runner e mesmas expectativas que o adapter TypeORM
 * atravessa: é a comparação de resultado que a §5 exige, e não uma suíte
 * paralela mais permissiva. SQLite continua sendo dialeto de referência, não
 * célula da matriz.
 */
beforeAll(() => {
  openSqlite();
}, 60_000);

afterAll(closeSqlite);

describe.each(CORPUS_CASES.map((testCase) => [testCase.id, testCase] as const))(
  'corpus %s',
  (_id, testCase) => {
    it(testCase.description, async () => {
      const actual = await runCorpusCase(testCase, sourceFor(testCase.rules));

      if (testCase.expect.kind === 'error') {
        expect(actual).toEqual({
          kind: 'error',
          status: testCase.expect.status,
          code: testCase.expect.code,
        });
        return;
      }

      expect(actual.kind).toBe('rows');

      if (testCase.expect.ids !== undefined) {
        expect(actual.ids).toEqual(testCase.expect.ids);
      }
      if (testCase.expect.total !== undefined) {
        expect(actual.total).toBe(testCase.expect.total);
      }
      if (testCase.expect.lastPage !== undefined) {
        expect(actual.lastPage).toBe(testCase.expect.lastPage);
      }
      if (testCase.expect.firstRow !== undefined) {
        expect(actual.firstRow).toEqual(testCase.expect.firstRow);
      }
    });
  }
);
