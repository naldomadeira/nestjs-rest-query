import { CORPUS_CASES } from '../../corpus/cases';
import {
  expectationFor,
  runCorpusCase,
  seedCorpus,
} from '../../fixtures/corpus-runner';
import { typeormSource } from '@infra/adapters/typeorm';
import {
  closeSqlite,
  corpusEntities,
  openSqlite,
  repositoryFor,
} from './helpers';

/**
 * Contract test do corpus contra SQLite.
 *
 * SQLite **não** é uma célula da matriz de paridade: aqui ele serve como
 * dialeto rápido para provar que o compilador implementa a semântica do plano.
 * A promessa de paridade é medida em `tests/v3/integration`, contra os três
 * bancos do perfil certificado.
 */
beforeAll(async () => {
  const dataSource = await openSqlite();
  await seedCorpus(dataSource, corpusEntities());
}, 60_000);

afterAll(closeSqlite);

describe.each(CORPUS_CASES.map((testCase) => [testCase.id, testCase] as const))(
  'corpus %s',
  (_id, testCase) => {
    it(testCase.description, async () => {
      const actual = await runCorpusCase(
        testCase,
        typeormSource(repositoryFor(testCase.rules), {
          fieldKinds: { post: { id: 'uuid' }, tag: { post_id: 'uuid' } },
        })
      );

      const expected = expectationFor(testCase, 'typeorm');

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
