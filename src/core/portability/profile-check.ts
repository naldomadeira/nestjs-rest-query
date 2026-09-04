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
  /**
   * `true` quando o **driver** entrega um instante ao banco em UTC.
   *
   * É fato do cliente, não do servidor, e por isso existe separado do
   * `sessionTimeZone`: um driver que converte para o fuso local do processo
   * grava o instante errado num servidor corretamente configurado em UTC. Pior,
   * ele *lê* com o mesmo deslocamento — então a aplicação inteira fica
   * auto-consistente e errada, e nada acusa.
   *
   * Foi exatamente o que a matriz de paridade encontrou: o TypeORM força
   * `useUTC: false` no driver do SQL Server quando `options.useUTC` não vem
   * marcado, e a célula dele passava com o dado errado enquanto Prisma e
   * Drizzle, que ficam em UTC, liam o instante errado.
   */
  clientDateTimeIsUtc: boolean;
  textColumns: readonly ProfileTextColumn[];
  indexes: readonly string[];
  requiredIndexes: readonly string[];
}

export interface ProfileViolation {
  rule:
    | 'encoding'
    | 'timezone'
    | 'client-timezone'
    | 'collation'
    | 'strict-mode'
    | 'index';
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

  // Servidor em UTC com driver em fuso local é o pior caso: a aplicação grava
  // e lê com o mesmo deslocamento, fica auto-consistente, e só um segundo
  // leitor em UTC revela o instante errado.
  if (!facts.clientDateTimeIsUtc) {
    violations.push({
      rule: 'client-timezone',
      detail:
        'the driver does not hand datetimes to the database in UTC; a known UTC instant came back shifted',
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
