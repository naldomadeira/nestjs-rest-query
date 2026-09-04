/**
 * Seed canônico do corpus (spec §18.2).
 *
 * Cobre texto numérico com zeros à esquerda, CPF/CEP, alfanumérico, limites de
 * integer/bigint, decimal de alta precisão, booleanos, date, datetime com
 * offsets, `null`, `%`, `_`, `\`, vírgula, espaços, caixa, acentos, Unicode
 * fora de ASCII, formas NFC/NFD, relações one/many/profundas, roots sem
 * relações, PK numérica, UUID e composta, empates de sort e múltiplas páginas.
 *
 * Valores textuais são persistidos em NFC; as colunas `*_folded` guardam
 * `value.normalize('NFC').toLowerCase()`.
 */

const fold = (value: string): string => value.normalize('NFC').toLowerCase();

export interface CorpusUserRow {
  id: number;
  name: string;
  name_folded: string;
  email: string;
  email_folded: string;
  document: string;
  zip: string;
  code: string;
  score: bigint;
  balance: string;
  active: boolean;
  born_on: string;
  created_at: string;
  nickname: string | null;
  company_id: number | null;
}

export interface CorpusCompanyRow {
  id: number;
  name: string;
  name_folded: string;
  owner_id: number | null;
}

export interface CorpusPostRow {
  id: string;
  id_order: string;
  title: string;
  title_folded: string;
  user_id: number;
}

export interface CorpusTagRow {
  post_id: string;
  label: string;
}

const user = (
  id: number,
  name: string,
  email: string,
  rest: Omit<
    CorpusUserRow,
    'id' | 'name' | 'name_folded' | 'email' | 'email_folded'
  >
): CorpusUserRow => ({
  id,
  name,
  name_folded: fold(name),
  email,
  email_folded: fold(email),
  ...rest,
});

const company = (
  id: number,
  name: string,
  owner_id: number | null
): CorpusCompanyRow => ({ id, name, name_folded: fold(name), owner_id });

const post = (id: string, title: string, user_id: number): CorpusPostRow => ({
  id,
  id_order: id,
  title,
  title_folded: fold(title),
  user_id,
});

const companies: CorpusCompanyRow[] = [
  company(1, 'Acme', 2),
  company(2, 'Órbita', 3),
  company(3, 'Nimbus', null),
];

const users: CorpusUserRow[] = [
  // 1 — texto numérico com zeros à esquerda, limite superior de bigint,
  // decimal de alta precisão, nickname null.
  user(1, 'Ada', 'ada@acme.test', {
    document: '00430123',
    zip: '01310-100',
    code: 'A-1',
    score: 9007199254740993n,
    balance: '12345678901234567890.123456',
    active: true,
    born_on: '1815-12-10',
    created_at: '2026-01-02T03:04:05.000Z',
    nickname: null,
    company_id: 1,
  }),
  // 2 — CPF, espaço interno no nickname.
  user(2, 'Grace', 'grace@acme.test', {
    document: '52998224725',
    zip: '20040-002',
    code: 'B-2',
    score: 42n,
    balance: '0.10',
    active: true,
    born_on: '1906-12-09',
    created_at: '2026-01-03T00:00:00.000Z',
    nickname: 'Amazing Grace',
    company_id: 1,
  }),
  // 3 — limite inferior de bigint, decimal negativo, boolean false.
  user(3, 'Alan', 'alan@orbita.test', {
    document: '11144477735',
    zip: '30110-000',
    code: 'C-3',
    score: -9007199254740993n,
    balance: '-1.50',
    active: false,
    born_on: '1912-06-23',
    created_at: '2026-01-04T00:00:00.000Z',
    nickname: null,
    company_id: 2,
  }),
  // 4 e 5 — empate de sort por `name` com o usuário 1.
  user(4, 'Ada', 'ada2@orbita.test', {
    document: '00000001',
    zip: '40010-000',
    code: 'D-4',
    score: 0n,
    balance: '0.00',
    active: true,
    born_on: '1990-01-01',
    created_at: '2026-01-05T00:00:00.000Z',
    nickname: null,
    company_id: 2,
  }),
  user(5, 'Ada', 'ada3@nimbus.test', {
    document: '00000002',
    zip: '50010-000',
    code: 'E-5',
    score: 1n,
    balance: '1.00',
    active: true,
    born_on: '1991-01-01',
    created_at: '2026-01-06T00:00:00.000Z',
    nickname: null,
    company_id: 3,
  }),
  // 6 — vírgula e espaço dentro do valor (CSV precisa de aspas/escape).
  user(6, 'A, B', 'comma@nimbus.test', {
    document: '00000003',
    zip: '60010-000',
    code: 'F-6',
    score: 2n,
    balance: '2.00',
    active: true,
    born_on: '1992-01-01',
    created_at: '2026-01-07T00:00:00.000Z',
    nickname: null,
    company_id: 3,
  }),
  // 7 — `%` literal.
  user(7, '100% pure', 'percent@nimbus.test', {
    document: '00000004',
    zip: '70010-000',
    code: 'G-7',
    score: 3n,
    balance: '3.00',
    active: true,
    born_on: '1993-01-01',
    created_at: '2026-01-08T00:00:00.000Z',
    nickname: null,
    company_id: 3,
  }),
  // 8 e 9 — mesmo texto dobrado, caixas diferentes, acento fora de ASCII.
  // Roots sem relação (company_id null).
  user(8, 'Ação', 'acao@nimbus.test', {
    document: '00000005',
    zip: '80010-000',
    code: 'H-8',
    score: 4n,
    balance: '4.00',
    active: true,
    born_on: '1994-01-01',
    created_at: '2026-01-09T00:00:00.000Z',
    nickname: null,
    company_id: null,
  }),
  user(9, 'AÇÃO', 'acao2@nimbus.test', {
    document: '00000006',
    zip: '90010-000',
    code: 'I-9',
    score: 5n,
    balance: '5.00',
    active: true,
    born_on: '1995-01-01',
    created_at: '2026-01-10T00:00:00.000Z',
    nickname: null,
    company_id: null,
  }),
  // 10 — `_` literal.
  user(10, 'under_score', 'underscore@nimbus.test', {
    document: '00000007',
    zip: '11010-000',
    code: 'J-10',
    score: 6n,
    balance: '6.00',
    active: true,
    born_on: '1996-01-01',
    created_at: '2026-01-11T00:00:00.000Z',
    nickname: null,
    company_id: null,
  }),
  // 11 — `\` literal.
  user(11, 'back\\slash', 'backslash@nimbus.test', {
    document: '00000008',
    zip: '12010-000',
    code: 'K-11',
    score: 7n,
    balance: '7.00',
    active: false,
    born_on: '1997-01-01',
    created_at: '2026-01-12T00:00:00.000Z',
    nickname: null,
    company_id: null,
  }),
];

const posts: CorpusPostRow[] = [
  post('11111111-1111-4111-8111-111111111111', 'Notes on the Engine', 1),
  post('22222222-2222-4222-8222-222222222222', 'Analytical Machine', 1),
  post('33333333-3333-4333-8333-333333333333', 'Bernoulli Numbers', 1),
  post('44444444-4444-4444-8444-444444444444', 'COBOL', 2),
  post('55555555-5555-4555-8555-555555555555', 'The Compiler', 2),
  post('66666666-6666-4666-8666-666666666666', 'On Computable Numbers', 3),
];

const tags: CorpusTagRow[] = [
  { post_id: '11111111-1111-4111-8111-111111111111', label: 'history' },
  { post_id: '11111111-1111-4111-8111-111111111111', label: 'math' },
  { post_id: '44444444-4444-4444-8444-444444444444', label: 'history' },
];

export const CORPUS_SEED = { users, companies, posts, tags } as const;
