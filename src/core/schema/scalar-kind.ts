/**
 * Tipos escalares lógicos (spec §9).
 *
 * Um tipo desconhecido nunca é tratado como `string`: o resolver do adapter
 * falha na inicialização até o campo ser mapeado.
 */
export type ScalarKind =
  | 'string'
  | 'uuid'
  | 'enum'
  | 'integer'
  | 'bigint'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'json'
  | 'binary';

export const SCALAR_KINDS: readonly ScalarKind[] = [
  'string',
  'uuid',
  'enum',
  'integer',
  'bigint',
  'decimal',
  'boolean',
  'date',
  'datetime',
  'json',
  'binary',
];

/**
 * Kinds cuja ordem total é idêntica nas três famílias de banco sob o perfil
 * certificado (spec §11). `uuid` e `enum` ficam de fora: o primeiro porque a
 * representação física difere (UNIQUEIDENTIFIER ordena por grupos de bytes no
 * SQL Server), o segundo porque a ordem depende do provider.
 */
const TOTAL_PORTABLE_ORDER: ReadonlySet<ScalarKind> = new Set([
  'string',
  'integer',
  'bigint',
  'decimal',
  'boolean',
  'date',
  'datetime',
]);

export function hasTotalPortableOrder(kind: ScalarKind): boolean {
  return TOTAL_PORTABLE_ORDER.has(kind);
}

/** Kinds que aceitam operadores de padrão textual. */
export const TEXTUAL_KINDS: ReadonlySet<ScalarKind> = new Set([
  'string',
  'uuid',
  'enum',
]);

/** Kinds sem operador por inferência: só via operadores registrados. */
export const OPAQUE_KINDS: ReadonlySet<ScalarKind> = new Set([
  'json',
  'binary',
]);
