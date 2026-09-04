import type { CorpusCase, CorpusDivergence } from './corpus.types';

/**
 * Prisma recusa operador de padrao onde o dialeto nao tem escape default.
 *
 * O Prisma nunca emite clausula `ESCAPE` - `contains` compila para
 * `LIKE ('%' || ? || '%')` e o client tipado nao permite acrescentar nada.
 * Em Postgres e MySQL isso nao e problema: a barra invertida ja e o escape
 * default, entao o valor escapado basta e o adapter produz o resultado
 * canonico. Em SQLite e SQL Server nao existe default - medido em SQLite, um
 * padrao escapado com barra invertida casa a string literal, nao o caractere
 * pretendido - entao o adapter recusa em vez de devolver o conjunto errado de
 * linhas (ADR-001, emenda 2).
 *
 * O recorte por dialeto e o que impede esta excecao de marcar como divergentes
 * as duas celulas onde o Prisma acerta.
 */
const PRISMA_PATTERN_REFUSAL: CorpusDivergence = {
  reason:
    'O Prisma nao emite clausula ESCAPE, e SQLite e SQL Server nao tem ' +
    'caractere de escape default no LIKE. Sem os dois, % e _ nao podem ser ' +
    'literais como a §11 exige, entao o adapter recusa o operador com ' +
    'CAPABILITY_UNAVAILABLE em vez de aproximar silenciosamente. Em Postgres ' +
    'e MySQL o escape default resolve, e o resultado canonico vale.',
  expect: { kind: 'error', status: 400, code: 'CAPABILITY_UNAVAILABLE' },
  dialects: ['sqlite', 'mssql'],
};

/**
 * Corpus canônico de paridade.
 *
 * Cada caso é executado, sem alteração, pelos contract tests (SQLite) e pela
 * matriz de integração real. Para modelos com PK composta, `ids` traz as partes
 * da chave unidas por `|` na ordem declarada em `primaryKey`.
 *
 * Toda ordenação esperada assume a collation binária/code-point do perfil
 * certificado (spec §6.3): ordem de code point para as três famílias de banco.
 */
export const CORPUS_CASES: readonly CorpusCase[] = [
  // --- Coerção dirigida pelo tipo do campo (spec §10.1) ---
  {
    id: 'coercion/numeric-text-keeps-leading-zeros',
    description: 'string com aparência numérica não é coagida para número',
    tags: ['numeric-text', 'leading-zeros'],
    rules: 'user.default',
    query: { filter: { document: { eq: '00430123' } } },
    expect: { kind: 'rows', ids: [1], total: 1, lastPage: 1 },
  },
  {
    id: 'coercion/integer-rejects-trailing-garbage',
    description: 'integer não usa parseInt permissivo',
    tags: ['numeric-text'],
    rules: 'user.default',
    query: { filter: { id: { eq: '10abc' } } },
    expect: { kind: 'error', status: 400, code: 'FILTER_VALUE_INVALID' },
  },
  {
    id: 'coercion/integer-rejects-decimal',
    description: 'integer não trunca decimal',
    tags: ['numeric-text'],
    rules: 'user.default',
    query: { filter: { id: { eq: '4.2' } } },
    expect: { kind: 'error', status: 400, code: 'FILTER_VALUE_INVALID' },
  },
  {
    id: 'coercion/bigint-above-safe-integer',
    description: 'bigint aceita valores acima da faixa segura de number',
    tags: ['bigint'],
    rules: 'user.default',
    query: { filter: { score: { eq: '9007199254740993' } } },
    expect: { kind: 'rows', ids: [1], total: 1, lastPage: 1 },
  },
  {
    id: 'coercion/bigint-below-safe-integer',
    description: 'bigint aceita valores abaixo da faixa segura de number',
    tags: ['bigint'],
    rules: 'user.default',
    query: { filter: { score: { eq: '-9007199254740993' } } },
    expect: { kind: 'rows', ids: [3], total: 1, lastPage: 1 },
  },
  {
    id: 'coercion/decimal-high-precision',
    description: 'decimal não passa por number e preserva a precisão',
    tags: ['decimal'],
    rules: 'user.default',
    query: { filter: { balance: { eq: '12345678901234567890.123456' } } },
    expect: { kind: 'rows', ids: [1], total: 1, lastPage: 1 },
  },
  {
    id: 'coercion/boolean-rejects-loose-input',
    description: 'boolean aceita apenas true/false/1/0',
    tags: ['boolean'],
    rules: 'user.default',
    query: { filter: { active: { eq: 'yes' } } },
    expect: { kind: 'error', status: 400, code: 'FILTER_VALUE_INVALID' },
  },
  {
    id: 'coercion/boolean-false',
    description: 'boolean false filtra corretamente',
    tags: ['boolean'],
    rules: 'user.default',
    query: { filter: { active: { eq: 'false' } } },
    expect: { kind: 'rows', ids: [3, 11], total: 2, lastPage: 1 },
  },
  {
    id: 'coercion/date-civil',
    description: 'date compara como data civil, sem fuso',
    tags: ['date'],
    rules: 'user.default',
    query: { filter: { born_on: { eq: '1815-12-10' } } },
    expect: { kind: 'rows', ids: [1], total: 1, lastPage: 1 },
  },
  {
    id: 'coercion/date-rejects-impossible-day',
    description: 'date valida a data real, não só o formato',
    tags: ['date'],
    rules: 'user.default',
    query: { filter: { born_on: { eq: '2026-02-30' } } },
    expect: { kind: 'error', status: 400, code: 'FILTER_VALUE_INVALID' },
  },
  {
    id: 'coercion/datetime-requires-timezone',
    description: 'datetime sem offset é inválido no perfil estrito',
    tags: ['datetime'],
    rules: 'user.default',
    query: { filter: { created_at: { eq: '2026-01-02T03:04:05' } } },
    expect: { kind: 'error', status: 400, code: 'FILTER_VALUE_INVALID' },
  },
  {
    id: 'coercion/datetime-offset-normalized-to-utc',
    description: 'datetime com offset é normalizado para o mesmo instante UTC',
    tags: ['datetime'],
    rules: 'user.default',
    query: { filter: { created_at: { eq: '2026-01-02T00:04:05-03:00' } } },
    expect: { kind: 'rows', ids: [1], total: 1, lastPage: 1 },
  },

  // --- Null (spec §10.1) ---
  {
    id: 'null/is-null-true',
    description: 'null só é consultado por isNull',
    tags: ['null'],
    rules: 'user.default',
    query: { filter: { nickname: { isNull: 'true' } } },
    expect: {
      kind: 'rows',
      ids: [1, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      total: 10,
      lastPage: 1,
    },
  },
  {
    id: 'null/eq-null-rejected',
    description: 'eq null é inválido',
    tags: ['null'],
    rules: 'user.default',
    query: { filter: { nickname: { eq: null } } },
    expect: { kind: 'error', status: 400, code: 'FILTER_VALUE_INVALID' },
  },

  {
    /**
     * Coluna nula não sai por `notIn`: vale a lógica de três valores do SQL.
     *
     * `nickname NOT IN ('Zed')` é `UNKNOWN` nas dez linhas de `nickname` nulo,
     * então elas ficam de fora mesmo sem casar nenhum item da lista; sobra a
     * única linha com valor, que não está listada. É a outra metade de "null
     * só é consultado por isNull" (§10.1) — quem quer as nulas pede `isNull`,
     * não `notIn`. As três famílias de banco concordam nisso, e o caso trava a
     * semântica nos três adapters: nenhum pode "consertar" o NULL por conta
     * própria acrescentando um `OR nickname IS NULL`, porque isso mudaria o
     * conjunto de linhas conforme o ORM.
     */
    id: 'null/not-in-keeps-only-non-null-unlisted',
    description: 'notIn não devolve linha de coluna nula',
    tags: ['null', 'csv-escape'],
    rules: 'user.default',
    query: { filter: { nickname: { notIn: 'Zed' } } },
    expect: { kind: 'rows', ids: [2], total: 1, lastPage: 1 },
  },
  // --- Padrões literais (spec §11) ---
  {
    id: 'like/percent-is-literal',
    description: '% no valor é caractere literal, não wildcard',
    tags: ['like-wildcards'],
    rules: 'user.default',
    query: { filter: { name: { like: '100%' } } },
    expect: { kind: 'rows', ids: [7], total: 1, lastPage: 1 },
    divergences: { prisma: PRISMA_PATTERN_REFUSAL },
  },
  {
    id: 'like/underscore-is-literal',
    description: '_ no valor é caractere literal, não coringa de 1 char',
    tags: ['like-wildcards'],
    rules: 'user.default',
    query: { filter: { name: { like: '_' } } },
    expect: { kind: 'rows', ids: [10], total: 1, lastPage: 1 },
    divergences: { prisma: PRISMA_PATTERN_REFUSAL },
  },
  {
    id: 'like/backslash-is-literal',
    description: 'barra invertida no valor é caractere literal',
    tags: ['like-wildcards'],
    rules: 'user.default',
    query: { filter: { name: { like: '\\' } } },
    expect: { kind: 'rows', ids: [11], total: 1, lastPage: 1 },
    divergences: { prisma: PRISMA_PATTERN_REFUSAL },
  },
  {
    id: 'like/is-case-sensitive',
    description: 'like é case-sensitive sob o perfil portável',
    tags: ['case-fold'],
    rules: 'user.default',
    query: { filter: { name: { like: 'AÇÃO' } } },
    expect: { kind: 'rows', ids: [9], total: 1, lastPage: 1 },
    divergences: { prisma: PRISMA_PATTERN_REFUSAL },
  },
  {
    id: 'ilike/case-fold',
    description: 'ilike casa caixas diferentes pelo folded field',
    tags: ['case-fold', 'unicode'],
    rules: 'user.default',
    query: { filter: { name: { ilike: 'ação' } } },
    expect: { kind: 'rows', ids: [8, 9], total: 2, lastPage: 1 },
    divergences: { prisma: PRISMA_PATTERN_REFUSAL },
  },
  {
    id: 'ilike/nfd-input-matches-nfc-storage',
    description: 'termo em NFD casa valores persistidos em NFC',
    tags: ['unicode', 'nfc-nfd', 'case-fold'],
    rules: 'user.default',
    query: { filter: { name: { ilike: 'AÇÃO'.normalize('NFD') } } },
    expect: { kind: 'rows', ids: [8, 9], total: 2, lastPage: 1 },
    divergences: { prisma: PRISMA_PATTERN_REFUSAL },
  },
  {
    id: 'search/or-across-configured-fields',
    description: 'search combina seus campos com OR',
    tags: ['case-fold'],
    rules: 'user.default',
    query: { search: 'ada' },
    expect: { kind: 'rows', ids: [1, 4, 5], total: 3, lastPage: 1 },
    divergences: { prisma: PRISMA_PATTERN_REFUSAL },
  },
  {
    /**
     * Busca por uma folha através de `many` é existencial (spec §11.1 e §12).
     *
     * A promessa medida aqui é a da §5: os três adapters devolvem a mesma
     * página **e** o mesmo total. O termo `co` casa `cobol` e `the compiler`
     * (dois posts do usuário 2), `on computable numbers` (um post do 3), e as
     * colunas de root de `comma@nimbus.test` (6) e `under_score` (10) — ou
     * seja, um alvo existencial e dois alvos escalares no mesmo OR, com um
     * root casando por dois itens.
     *
     * `perPage=3` é o que torna a divergência observável: compilado como join
     * de predicado, o `LIMIT 3` cai sobre as 5 linhas duplicadas pelo join e
     * consome duas delas no mesmo root, devolvendo 2 linhas numa página de 3 —
     * com `total` 4, porque a contagem sempre contou roots distintos. Página
     * curta com total certo é o sintoma exato que este caso proíbe.
     */
    id: 'search/through-many-is-existential',
    description:
      'search por folha através de many não duplica nem encurta a página',
    tags: ['relation-many', 'case-fold', 'pagination'],
    rules: 'user.deep',
    query: { search: 'co', page: '1', perPage: '3' },
    expect: { kind: 'rows', ids: [2, 3, 6], total: 4, lastPage: 2 },
    divergences: { prisma: PRISMA_PATTERN_REFUSAL },
  },
  {
    id: 'search/not-configured',
    description: 'search em endpoint sem campos de busca é rejeitado',
    tags: ['case-fold'],
    rules: 'user.no-search',
    query: { search: 'ada' },
    expect: { kind: 'error', status: 400, code: 'FIELD_NOT_ALLOWED' },
  },

  // --- Listas (spec §10.2) ---
  {
    id: 'list/csv-quoted-comma',
    description: 'CSV com aspas preserva vírgula interna',
    tags: ['csv-escape'],
    rules: 'user.default',
    query: { filter: { name: { in: '"A, B",Grace' } } },
    expect: { kind: 'rows', ids: [2, 6], total: 2, lastPage: 1 },
  },
  {
    id: 'list/csv-escaped-comma',
    description: 'CSV com escape por barra invertida preserva vírgula interna',
    tags: ['csv-escape'],
    rules: 'user.default',
    query: { filter: { name: { in: 'A\\, B' } } },
    expect: { kind: 'rows', ids: [6], total: 1, lastPage: 1 },
  },
  {
    id: 'list/in-empty-is-always-false',
    description: 'in=[] compila para condição sempre falsa',
    tags: ['csv-escape'],
    rules: 'user.default',
    query: { filter: { id: { in: [] } } },
    expect: { kind: 'rows', ids: [], total: 0, lastPage: 1 },
  },
  {
    id: 'list/not-in-empty-is-always-true',
    description: 'notIn=[] compila para condição sempre verdadeira',
    tags: ['csv-escape'],
    rules: 'user.default',
    query: { filter: { id: { notIn: [] } } },
    expect: {
      kind: 'rows',
      ids: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      total: 11,
      lastPage: 1,
    },
  },
  {
    /**
     * O caminho de `NOT IN` com valores — que `notIn=[]` não exercita.
     *
     * `notIn=[]` é sempre-verdadeiro e é elidido do `AND`: por causa dele
     * nenhum adapter chega a emitir `NOT IN`. Este caso é o que obriga os três
     * a compilar a lista de verdade e a concordar sobre a §11 (`notIn` é
     * "pertinência após coerção item a item", negada): as três linhas `Ada` e
     * a `Grace` saem do conjunto e todo o resto continua, sem depender de
     * ordem de itens nem de quantos itens a lista tem.
     */
    id: 'list/not-in-with-values-excludes-listed',
    description: 'notIn com valores remove exatamente os itens listados',
    tags: ['csv-escape'],
    rules: 'user.default',
    query: { filter: { name: { notIn: 'Ada,Grace' } } },
    expect: {
      kind: 'rows',
      ids: [3, 6, 7, 8, 9, 10, 11],
      total: 7,
      lastPage: 1,
    },
  },
  {
    /**
     * `null` dentro da lista é recusado antes do compiler (spec §10.1).
     *
     * A promessa aqui é de portabilidade, não de conveniência: `x NOT IN (a,
     * NULL)` é `UNKNOWN` para toda linha nas três famílias de banco, isto é,
     * um `notIn` com `NULL` no conjunto devolveria sempre vazio. Recusar o
     * item mantém "null só é consultado por isNull" e impede que o cliente
     * escreva, sem perceber, um filtro que nunca casa nada.
     */
    id: 'list/not-in-rejects-null-item',
    description: 'null dentro da lista de notIn é inválido',
    tags: ['csv-escape', 'null'],
    rules: 'user.default',
    query: { filter: { name: { notIn: ['Ada', null] } } },
    expect: { kind: 'error', status: 400, code: 'FILTER_VALUE_INVALID' },
  },
  {
    id: 'list/between-requires-two-values',
    description: 'between exige exatamente dois valores',
    tags: ['csv-escape'],
    rules: 'user.default',
    query: { filter: { id: { between: '1' } } },
    expect: { kind: 'error', status: 400, code: 'FILTER_VALUE_INVALID' },
  },
  {
    id: 'list/between-is-inclusive',
    description: 'between é um intervalo inclusivo',
    tags: ['csv-escape'],
    rules: 'user.default',
    query: { filter: { id: { between: '2,4' } } },
    expect: { kind: 'rows', ids: [2, 3, 4], total: 3, lastPage: 1 },
  },

  // --- Relações (spec §11.1 e §13) ---
  {
    id: 'relation-one/filter-without-include-creates-join',
    description: 'filter por relação funciona sem includes',
    tags: ['relation-one'],
    rules: 'user.default',
    query: { filter: { 'company.name': { eq: 'Acme' } } },
    expect: { kind: 'rows', ids: [1, 2], total: 2, lastPage: 1 },
  },
  {
    /**
     * Relação ausente também não sai por `notIn` — o mesmo NULL, outra origem.
     *
     * Nas linhas 8 a 11 não existe `company`, então a folha `company.name` não
     * tem valor nenhum para comparar: o filtro por relação `one` é
     * "a folha é comparada na relação associada" (§11.1), e sem relação
     * associada não há associação a negar. O caso importa porque o NULL aqui
     * não vem da coluna, e sim do join, e é exatamente onde os adapters
     * poderiam divergir — quem resolve a relação com `LEFT JOIN` cai na lógica
     * de três valores, quem resolve com `INNER JOIN` ou subconsulta descarta a
     * linha antes; as duas rotas têm de devolver o mesmo conjunto.
     */
    id: 'relation-one/not-in-through-absent-relation',
    description: 'notIn por relação one exige a relação presente',
    tags: ['relation-one', 'null', 'csv-escape'],
    rules: 'user.default',
    query: { filter: { 'company.name': { notIn: 'Acme' } } },
    expect: { kind: 'rows', ids: [3, 4, 5, 6, 7], total: 5, lastPage: 1 },
  },
  {
    id: 'relation-one/is-null-true-means-absent',
    description: 'isNull=true em relação one significa relação ausente',
    tags: ['relation-one', 'null'],
    rules: 'user.deep',
    query: { filter: { company: { isNull: 'true' } } },
    expect: { kind: 'rows', ids: [8, 9, 10, 11], total: 4, lastPage: 1 },
  },
  {
    id: 'relation-one/is-null-false-means-present',
    description: 'isNull=false em relação one significa relação presente',
    tags: ['relation-one', 'null'],
    rules: 'user.deep',
    query: { filter: { company: { isNull: 'false' } } },
    expect: { kind: 'rows', ids: [1, 2, 3, 4, 5, 6, 7], total: 7, lastPage: 1 },
  },
  {
    // Autorização vem antes da validação de tipo: como as regras só podem
    // declarar `isNull` para uma relação (`defineQueryRules` rejeita o resto
    // na inicialização), o erro observável por HTTP é OPERATOR_NOT_ALLOWED.
    id: 'relation-one/other-operators-are-invalid',
    description: 'operador diferente de isNull aplicado à relação é inválido',
    tags: ['relation-one'],
    rules: 'user.deep',
    query: { filter: { company: { eq: '1' } } },
    expect: { kind: 'error', status: 400, code: 'OPERATOR_NOT_ALLOWED' },
  },
  {
    id: 'auth/relation-whitelist-is-exact',
    description: 'autorizar company não autoriza company.name',
    tags: ['relation-one'],
    rules: 'user.company-root-only',
    query: { filter: { 'company.name': { eq: 'Acme' } } },
    expect: { kind: 'error', status: 400, code: 'FIELD_NOT_ALLOWED' },
  },
  {
    id: 'relation-many/existential-semantics',
    description: 'dotted path por relação many é existencial',
    tags: ['relation-many'],
    rules: 'user.deep',
    query: { filter: { 'posts.title': { eq: 'COBOL' } } },
    expect: { kind: 'rows', ids: [2], total: 1, lastPage: 1 },
  },
  {
    id: 'relation-many/is-null-true-means-empty',
    description: 'isNull=true em relação many significa coleção vazia',
    tags: ['relation-many', 'null'],
    rules: 'user.deep',
    query: { filter: { posts: { isNull: 'true' } } },
    expect: {
      kind: 'rows',
      ids: [4, 5, 6, 7, 8, 9, 10, 11],
      total: 8,
      lastPage: 1,
    },
  },
  {
    id: 'relation-many/is-null-false-means-any',
    description: 'isNull=false em relação many significa ao menos um item',
    tags: ['relation-many', 'null'],
    rules: 'user.deep',
    query: { filter: { posts: { isNull: 'false' } } },
    expect: { kind: 'rows', ids: [1, 2, 3], total: 3, lastPage: 1 },
  },
  {
    id: 'relation-many/sort-through-many-is-not-allowed',
    description: 'sort direto por folha através de many é inválido',
    tags: ['relation-many', 'sort-tie'],
    rules: 'user.deep',
    query: { sort: 'posts.title' },
    expect: { kind: 'error', status: 400, code: 'FIELD_NOT_ALLOWED' },
  },
  {
    id: 'relation-deep/stays-nested',
    description: 'company.owner nunca vira company_owner',
    tags: ['relation-deep', 'relation-one'],
    rules: 'user.deep',
    query: { filter: { id: { eq: '1' } }, includes: 'company,company.owner' },
    expect: {
      kind: 'rows',
      ids: [1],
      total: 1,
      lastPage: 1,
      firstRow: {
        id: 1,
        name: 'Ada',
        company: { id: 1, name: 'Acme', owner: { id: 2, name: 'Grace' } },
      },
    },
  },

  // --- Projeção (spec §13) ---
  {
    id: 'projection/fields-with-include-keeps-relation',
    description: 'fields + includes preserva a relação aninhada',
    tags: ['relation-one'],
    rules: 'user.default',
    query: {
      filter: { id: { eq: '1' } },
      fields: 'id,name,company.name',
      includes: 'company',
    },
    expect: {
      kind: 'rows',
      ids: [1],
      total: 1,
      lastPage: 1,
      firstRow: { id: 1, name: 'Ada', company: { name: 'Acme' } },
    },
  },
  {
    id: 'projection/relation-fields-require-include',
    description: 'fields=company.name exige includes=company',
    tags: ['relation-one'],
    rules: 'user.default',
    query: { fields: 'id,company.name' },
    expect: { kind: 'error', status: 400, code: 'FIELD_NOT_ALLOWED' },
  },
  {
    id: 'projection/defaults-when-fields-absent',
    description: 'sem fields na URL usa os defaults configurados',
    tags: ['relation-one'],
    rules: 'user.default',
    query: { filter: { id: { eq: '1' } } },
    expect: {
      kind: 'rows',
      ids: [1],
      total: 1,
      lastPage: 1,
      firstRow: { id: 1, name: 'Ada' },
    },
  },
  {
    id: 'projection/pk-removed-when-not-visible',
    description: 'PK usada internamente é removida do JSON se não projetada',
    tags: ['relation-one'],
    rules: 'user.default',
    query: { filter: { id: { eq: '1' } }, fields: 'name' },
    expect: {
      // Sem `ids`: a PK não está na projeção, então não é observável.
      kind: 'rows',
      total: 1,
      lastPage: 1,
      firstRow: { name: 'Ada' },
    },
  },
  {
    id: 'projection/folded-field-is-never-exposed',
    description: 'folded field não aparece no JSON nem pode ser pedido',
    tags: ['case-fold'],
    rules: 'user.default',
    query: { fields: 'id,name_folded' },
    expect: { kind: 'error', status: 400, code: 'FIELD_NOT_ALLOWED' },
  },
  {
    id: 'projection/unknown-field-is-rejected',
    description: 'campo fora da whitelist é rejeitado',
    tags: ['relation-one'],
    rules: 'user.default',
    query: { fields: 'id,secret' },
    expect: { kind: 'error', status: 400, code: 'FIELD_NOT_ALLOWED' },
  },
  {
    id: 'includes/unknown-relation-is-rejected',
    description: 'include fora da whitelist é rejeitado',
    tags: ['relation-one'],
    rules: 'user.default',
    query: { includes: 'secrets' },
    expect: { kind: 'error', status: 400, code: 'FIELD_NOT_ALLOWED' },
  },

  // --- Sort (spec §14) ---
  {
    id: 'sort/tie-broken-by-primary-key',
    description: 'empate de sort é desempatado pela PK ascendente',
    tags: ['sort-tie'],
    rules: 'user.default',
    query: { filter: { name: { eq: 'Ada' } }, sort: 'name' },
    expect: { kind: 'rows', ids: [1, 4, 5], total: 3, lastPage: 1 },
  },
  {
    id: 'sort/descending-keeps-ascending-tie-break',
    description: 'sort desc mantém o desempate de PK ascendente',
    tags: ['sort-tie'],
    rules: 'user.default',
    query: { filter: { name: { eq: 'Ada' } }, sort: '-name' },
    expect: { kind: 'rows', ids: [1, 4, 5], total: 3, lastPage: 1 },
  },
  {
    id: 'sort/duplicate-same-direction-is-deduped',
    description: 'sort repetido com a mesma direção é deduplicado',
    tags: ['sort-tie'],
    rules: 'user.default',
    query: { sort: 'code,code' },
    expect: {
      kind: 'rows',
      ids: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      total: 11,
      lastPage: 1,
    },
  },
  {
    id: 'sort/conflicting-directions',
    description: 'sort duplicado com direções opostas é erro',
    tags: ['sort-tie'],
    rules: 'user.default',
    query: { sort: 'code,-code' },
    expect: { kind: 'error', status: 400, code: 'SORT_CONFLICT' },
  },
  {
    id: 'sort/descending-reverses-code-order',
    description: 'sort descendente inverte a ordem de code point',
    tags: ['sort-tie'],
    rules: 'user.default',
    query: { sort: '-code' },
    expect: {
      kind: 'rows',
      ids: [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
      total: 11,
      lastPage: 1,
    },
  },
  {
    // A ausência de `portableOrderField` num campo autorizado para ordem é
    // erro de *configuração*: `defineQueryRules` falha na inicialização, então
    // não existe requisição capaz de alcançá-lo. O corpus cobre o caminho
    // observável — a ordem sai pela coluna portável, não pelo UUID nativo.
    id: 'sort/uuid-orders-by-portable-order-field',
    description: 'sort por UUID usa a coluna de ordem portável',
    tags: ['uuid-pk', 'sort-tie'],
    rules: 'post.portable-order',
    query: { sort: 'id' },
    expect: {
      kind: 'rows',
      ids: [
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
        '33333333-3333-4333-8333-333333333333',
        '44444444-4444-4444-8444-444444444444',
        '55555555-5555-4555-8555-555555555555',
        '66666666-6666-4666-8666-666666666666',
      ],
      total: 6,
      lastPage: 1,
    },
  },
  {
    id: 'uuid-pk/filter-by-uuid',
    description: 'UUID é filtrável por igualdade',
    tags: ['uuid-pk'],
    rules: 'post.portable-order',
    query: { filter: { id: { eq: '44444444-4444-4444-8444-444444444444' } } },
    expect: {
      kind: 'rows',
      ids: ['44444444-4444-4444-8444-444444444444'],
      total: 1,
      lastPage: 1,
    },
  },
  {
    id: 'uuid-pk/rejects-malformed-uuid',
    description: 'UUID malformado é rejeitado antes da consulta',
    tags: ['uuid-pk'],
    rules: 'post.portable-order',
    query: { filter: { id: { eq: 'not-a-uuid' } } },
    expect: { kind: 'error', status: 400, code: 'FILTER_VALUE_INVALID' },
  },
  {
    id: 'composite-pk/tie-break-uses-every-part',
    description: 'PK composta inteira é usada no desempate',
    tags: ['composite-pk', 'sort-tie'],
    rules: 'tag.default',
    query: {},
    expect: {
      kind: 'rows',
      ids: [
        '11111111-1111-4111-8111-111111111111|history',
        '11111111-1111-4111-8111-111111111111|math',
        '44444444-4444-4444-8444-444444444444|history',
      ],
      total: 3,
      lastPage: 1,
    },
  },

  // --- Paginação (spec §14) ---
  {
    id: 'pagination/first-page',
    description: 'page e perPage delimitam a página',
    tags: ['pagination'],
    rules: 'user.default',
    query: { page: '1', perPage: '3' },
    expect: { kind: 'rows', ids: [1, 2, 3], total: 11, lastPage: 4 },
  },
  {
    id: 'pagination/second-page',
    description: 'a segunda página continua de onde a primeira parou',
    tags: ['pagination'],
    rules: 'user.default',
    query: { page: '2', perPage: '3' },
    expect: { kind: 'rows', ids: [4, 5, 6], total: 11, lastPage: 4 },
  },
  {
    id: 'pagination/many-counts-distinct-roots',
    description: 'total conta roots, não linhas de join',
    tags: ['relation-many', 'pagination'],
    rules: 'user.deep',
    query: { includes: 'posts', perPage: '2', page: '1' },
    expect: { kind: 'rows', ids: [1, 2], total: 11, lastPage: 6 },
  },
  {
    id: 'pagination/paginate-false-returns-data-only',
    description: 'paginate=false retorna apenas data',
    tags: ['pagination'],
    rules: 'user.default',
    query: { paginate: 'false', filter: { id: { eq: '1' } } },
    expect: { kind: 'rows', ids: [1] },
  },
  {
    id: 'pagination/page-zero-is-invalid',
    description: 'page precisa ser >= 1',
    tags: ['pagination'],
    rules: 'user.default',
    query: { page: '0' },
    expect: { kind: 'error', status: 400, code: 'PAGINATION_INVALID' },
  },
  {
    id: 'pagination/per-page-above-max-is-invalid',
    description: 'perPage não pode exceder maxPerPage',
    tags: ['pagination'],
    rules: 'user.default',
    query: { perPage: '101' },
    expect: { kind: 'error', status: 400, code: 'PAGINATION_INVALID' },
  },
  {
    id: 'pagination/non-integer-page-is-invalid',
    description: 'page aceita somente inteiro decimal completo',
    tags: ['pagination'],
    rules: 'user.default',
    query: { page: '1.5' },
    expect: { kind: 'error', status: 400, code: 'PAGINATION_INVALID' },
  },
  {
    id: 'pagination/last-page-is-at-least-one',
    description: 'lastPage permanece 1 mesmo sem resultados',
    tags: ['pagination'],
    rules: 'user.default',
    query: { filter: { id: { eq: '999' } } },
    expect: { kind: 'rows', ids: [], total: 0, lastPage: 1 },
  },

  // --- Autorização e sintaxe (spec §8.3, §17.1) ---
  {
    id: 'operator/not-allowed-for-field',
    description: 'operador fora da lista do campo é rejeitado',
    tags: ['numeric-text'],
    rules: 'user.default',
    query: { filter: { id: { ilike: '1' } } },
    expect: { kind: 'error', status: 400, code: 'OPERATOR_NOT_ALLOWED' },
  },
  {
    id: 'syntax/unsafe-path-is-rejected',
    description: 'path com caractere fora do alfabeto seguro é rejeitado',
    tags: ['numeric-text'],
    rules: 'user.default',
    query: { filter: { 'name;drop': { eq: 'x' } } },
    expect: { kind: 'error', status: 400, code: 'QUERY_SYNTAX_INVALID' },
  },
  {
    id: 'syntax/wildcard-from-client-is-rejected',
    description: 'wildcard nunca é aceito a partir de input do cliente',
    tags: ['numeric-text'],
    rules: 'user.default',
    query: { fields: 'company.*' },
    expect: { kind: 'error', status: 400, code: 'QUERY_SYNTAX_INVALID' },
  },
  {
    id: 'syntax/filter-must-be-an-object',
    description: 'filter que não é objeto é rejeitado',
    tags: ['numeric-text'],
    rules: 'user.default',
    query: { filter: 'name' },
    expect: { kind: 'error', status: 400, code: 'QUERY_SYNTAX_INVALID' },
  },
];
