import { typeormSource } from '@infra/adapters/typeorm';
import { CORPUS_CASES } from '../corpus/cases';
import { runCorpusCase, seedCorpus } from '../fixtures/corpus-runner';
import {
  assertProfile,
  openDialect,
  selectedDialect,
  type IntegrationContext,
} from './setup';

/**
 * Uma célula da matriz ORM × banco (spec §19).
 *
 * A célula é escolhida por `DQB_DIALECT` mais a URL correspondente. Sem elas o
 * arquivo se declara pulado — skip local é permitido, skip em CI não: o job
 * `database-matrix` roda `scripts/assert-no-skips.mjs` depois da suíte.
 */
const dialect = selectedDialect();

const describeCell = dialect ? describe : describe.skip;

describeCell(`corpus real — ${dialect ?? 'sem célula selecionada'}`, () => {
  let context: IntegrationContext;

  beforeAll(async () => {
    context = await openDialect(dialect!);
    await assertProfile(context);
    await seedCorpus(context.dataSource, context.entities);
  }, 180_000);

  afterAll(async () => {
    await context?.dataSource.destroy();
  });

  it.each(CORPUS_CASES.map((testCase) => [testCase.id, testCase] as const))(
    '%s',
    async (_id, testCase) => {
      const actual = await runCorpusCase(
        testCase,
        typeormSource(context.repositoryFor(testCase.rules), {
          fieldKinds: { post: { id: 'uuid' }, tag: { post_id: 'uuid' } },
        })
      );

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
    },
    30_000
  );
});
