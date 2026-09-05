import { checkPortabilityProfile } from '@core/portability';
import type { ProfileFacts } from '@core/portability';

const ok: ProfileFacts = {
  dialect: 'postgres',
  serverVersion: '18.0',
  encoding: 'UTF8',
  sessionTimeZone: 'UTC',
  strictMode: true,
  textColumns: [
    { table: 'users', column: 'name', collation: 'C' },
    { table: 'users', column: 'name_folded', collation: 'C' },
  ],
  indexes: ['users_pkey', 'users_company_id_idx', 'users_name_folded_idx'],
  requiredIndexes: [
    'users_pkey',
    'users_company_id_idx',
    'users_name_folded_idx',
  ],
};

describe('checkPortabilityProfile', () => {
  it('não acusa violação em um perfil conforme', () => {
    expect(checkPortabilityProfile(ok)).toEqual([]);
  });

  it('acusa encoding não Unicode', () => {
    expect(checkPortabilityProfile({ ...ok, encoding: 'LATIN1' })).toEqual([
      { rule: 'encoding', detail: 'expected UTF8/UTF-8, found LATIN1' },
    ]);
  });

  it('aceita utf8mb4 no MySQL', () => {
    expect(
      checkPortabilityProfile({
        ...ok,
        dialect: 'mysql',
        encoding: 'utf8mb4',
        textColumns: [
          { table: 'users', column: 'name', collation: 'utf8mb4_bin' },
        ],
      })
    ).toEqual([]);
  });

  it('acusa timezone de sessão diferente de UTC', () => {
    expect(
      checkPortabilityProfile({ ...ok, sessionTimeZone: 'America/Sao_Paulo' })
    ).toEqual([
      { rule: 'timezone', detail: 'expected UTC, found America/Sao_Paulo' },
    ]);
  });

  it('acusa collation não certificada em coluna textual', () => {
    expect(
      checkPortabilityProfile({
        ...ok,
        textColumns: [
          { table: 'users', column: 'name', collation: 'en_US.utf8' },
        ],
      })
    ).toEqual([
      {
        rule: 'collation',
        detail: 'users.name uses en_US.utf8, expected one of C, ucs_basic',
      },
    ]);
  });

  it('acusa modo não estrito', () => {
    expect(checkPortabilityProfile({ ...ok, strictMode: false })).toEqual([
      { rule: 'strict-mode', detail: 'server is not running in strict mode' },
    ]);
  });

  it('acusa índice exigido ausente', () => {
    expect(checkPortabilityProfile({ ...ok, indexes: ['users_pkey'] })).toEqual(
      [
        {
          rule: 'index',
          detail: 'missing required index users_company_id_idx',
        },
        {
          rule: 'index',
          detail: 'missing required index users_name_folded_idx',
        },
      ]
    );
  });

  it('acumula violações múltiplas na ordem das regras', () => {
    const violations = checkPortabilityProfile({
      ...ok,
      encoding: 'LATIN1',
      strictMode: false,
    });
    expect(violations.map((v) => v.rule)).toEqual(['encoding', 'strict-mode']);
  });
});
