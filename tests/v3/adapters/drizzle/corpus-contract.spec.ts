import { CORPUS_CASES } from '../../corpus/cases';
import { expectationFor, runCorpusCase } from '../../fixtures/corpus-runner';
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

      const expected = expectationFor(testCase, 'drizzle', 'sqlite');

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
    });
  }
);
