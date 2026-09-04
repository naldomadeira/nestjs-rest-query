import { CORPUS_CASES } from '../../corpus/cases';
import { runCorpusCase } from '../../fixtures/corpus-runner';
import { closeSqlite, openSqlite, seedSqlite, sourceFor } from './helpers';

/**
 * Contract test do corpus contra o adapter Prisma.
 *
 * Mesmos casos, mesmo runner e mesmas expectativas que os adapters TypeORM e
 * Drizzle atravessam: é a comparação de resultado que a §5 exige, e não uma
 * suíte paralela mais permissiva. SQLite continua sendo dialeto de
 * referência, não célula da matriz — as nove células reais medem a promessa
 * (spec §18). O client é gerado de verdade (`pnpm prisma:generate`), não
 * mockado: o generator a partir de `schema.prisma` continua não existindo
 * (spec §15.2), então o manifesto usado aqui é escrito à mão.
 */
beforeAll(async () => {
  openSqlite();
  await seedSqlite();
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
