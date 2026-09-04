import { CORPUS_CASES } from '../../corpus/cases';
import { expectationFor, runCorpusCase } from '../../fixtures/corpus-runner';
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

      const expected = expectationFor(testCase, 'prisma');

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
