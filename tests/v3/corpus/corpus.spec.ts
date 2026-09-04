import { CORPUS_CASES } from './cases';
import { CORPUS_SEED } from './seed';
import { CORPUS_MODEL } from './model';
import { REST_QUERY_ERROR_CODES } from './corpus.types';

describe('corpus canônico', () => {
  it('tem ids únicos', () => {
    const ids = CORPUS_CASES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('usa apenas códigos de erro do contrato', () => {
    const codes = CORPUS_CASES.filter((c) => c.expect.kind === 'error').map(
      (c) => (c.expect as { code: string }).code
    );
    expect(codes.length).toBeGreaterThan(0);
    for (const code of codes) {
      expect(REST_QUERY_ERROR_CODES).toContain(code);
    }
  });

  it('só referencia ids de root que existem no seed', () => {
    const rootIds: Record<string, ReadonlySet<string>> = {
      user: new Set(CORPUS_SEED.users.map((u) => String(u.id))),
      post: new Set(CORPUS_SEED.posts.map((p) => p.id)),
      tag: new Set(CORPUS_SEED.tags.map((t) => `${t.post_id}|${t.label}`)),
      company: new Set(CORPUS_SEED.companies.map((c) => String(c.id))),
    };

    for (const testCase of CORPUS_CASES) {
      if (testCase.expect.kind !== 'rows') continue;
      const model = testCase.rules.split('.')[0];
      for (const id of testCase.expect.ids ?? []) {
        expect(rootIds[model].has(String(id))).toBe(true);
      }
    }
  });

  it('cobre todas as áreas obrigatórias do spec §18.2', () => {
    const tags = new Set(CORPUS_CASES.flatMap((c) => c.tags));
    for (const required of [
      'numeric-text',
      'leading-zeros',
      'bigint',
      'decimal',
      'boolean',
      'date',
      'datetime',
      'null',
      'like-wildcards',
      'csv-escape',
      'unicode',
      'nfc-nfd',
      'case-fold',
      'relation-one',
      'relation-many',
      'relation-deep',
      'composite-pk',
      'uuid-pk',
      'sort-tie',
      'pagination',
    ]) {
      expect(tags).toContain(required);
    }
  });

  it('descreve o modelo canônico usado por todos os adapters', () => {
    expect(Object.keys(CORPUS_MODEL)).toEqual([
      'user',
      'company',
      'post',
      'tag',
    ]);
  });

  it('mantém as colunas folded coerentes com o helper de dobra', () => {
    const fold = (v: string) => v.normalize('NFC').toLowerCase();
    for (const user of CORPUS_SEED.users) {
      expect(user.name_folded).toBe(fold(user.name));
      expect(user.email_folded).toBe(fold(user.email));
    }
    for (const company of CORPUS_SEED.companies) {
      expect(company.name_folded).toBe(fold(company.name));
    }
  });

  it('todo caso referencia um preset de regras nomeado', () => {
    for (const testCase of CORPUS_CASES) {
      expect(testCase.rules).toMatch(/^[a-z]+\.[a-z-]+$/);
    }
  });
});
