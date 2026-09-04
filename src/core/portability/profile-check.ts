/**
 * Checagem do perfil certificado de banco (spec §6.3).
 *
 * Paridade não é prometida sobre configuração arbitrária. Antes de aceitar
 * tráfego, a aplicação consulta os catálogos do banco, monta um `ProfileFacts`
 * e roda esta checagem; qualquer violação vira `PORTABILITY_PROFILE_MISMATCH`.
 *
 * Esta função é pura: quem lê o catálogo é o adapter, quem lança o erro é a
 * inicialização. Assim o núcleo continua sem importar driver nenhum.
 */

export type ProfileDialect = 'postgres' | 'mysql' | 'mssql';

export interface ProfileTextColumn {
  table: string;
  column: string;
  collation: string;
}

export interface ProfileFacts {
  dialect: ProfileDialect;
  serverVersion: string;
  encoding: string;
  sessionTimeZone: string;
  strictMode: boolean;
  textColumns: readonly ProfileTextColumn[];
  indexes: readonly string[];
  requiredIndexes: readonly string[];
}

export interface ProfileViolation {
  rule: 'encoding' | 'timezone' | 'collation' | 'strict-mode' | 'index';
  detail: string;
}

const UNICODE_ENCODINGS = new Set([
  'UTF8',
  'UTF-8',
  'utf8',
  'utf8mb4',
  'UTF8MB4',
]);

/**
 * Collations binárias/code-point certificadas por dialeto. São elas que fazem
 * `eq`, `ne`, `like` e a comparação do valor dobrado produzirem a mesma ordem
 * e a mesma igualdade nas três famílias de banco.
 */
const CERTIFIED_COLLATIONS: Record<ProfileDialect, readonly string[]> = {
  postgres: ['C', 'ucs_basic'],
  mysql: ['utf8mb4_bin', 'utf8mb4_0900_bin'],
  mssql: ['Latin1_General_100_BIN2_UTF8'],
};

export function checkPortabilityProfile(
  facts: ProfileFacts
): ProfileViolation[] {
  const violations: ProfileViolation[] = [];

  if (!UNICODE_ENCODINGS.has(facts.encoding)) {
    violations.push({
      rule: 'encoding',
      detail: `expected UTF8/UTF-8, found ${facts.encoding}`,
    });
  }

  if (facts.sessionTimeZone !== 'UTC') {
    violations.push({
      rule: 'timezone',
      detail: `expected UTC, found ${facts.sessionTimeZone}`,
    });
  }

  const certified = CERTIFIED_COLLATIONS[facts.dialect];
  for (const column of facts.textColumns) {
    if (!certified.includes(column.collation)) {
      violations.push({
        rule: 'collation',
        detail: `${column.table}.${column.column} uses ${column.collation}, expected one of ${certified.join(', ')}`,
      });
    }
  }

  if (!facts.strictMode) {
    violations.push({
      rule: 'strict-mode',
      detail: 'server is not running in strict mode',
    });
  }

  const present = new Set(facts.indexes);
  for (const required of facts.requiredIndexes) {
    if (!present.has(required)) {
      violations.push({
        rule: 'index',
        detail: `missing required index ${required}`,
      });
    }
  }

  return violations;
}
