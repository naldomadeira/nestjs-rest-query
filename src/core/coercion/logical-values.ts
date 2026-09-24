/**
 * Marcas de identidade dos valores lógicos, registradas no registro global de
 * símbolos.
 *
 * O pacote publica um bundle por subpath (`nestjs-rest-query`,
 * `nestjs-rest-query/typeorm`, `/prisma`, `/drizzle`) sem chunk compartilhado,
 * e cada bundle carrega **a sua cópia** destas classes. O plano é construído
 * pelo núcleo do root e compilado pelo adapter do subpath, então um
 * `instanceof` nominal falhava em toda fronteira de bundle: o adapter não
 * reconhecia o `DecimalValue` do núcleo, repassava o objeto ao driver, e o
 * `pg` o serializava com `JSON.stringify` — `'"29.90"'`, 500 no PostgreSQL. O
 * mesmo valia para `CivilDate` (`kind: 'date'`) nos três adapters. Nada disso
 * aparecia na suíte, que importa tudo de `src/` e portanto de uma cópia só.
 *
 * `Symbol.for` devolve o mesmo símbolo em qualquer cópia do módulo — inclusive
 * entre o build CJS e o ESM carregados no mesmo processo —, e o
 * `Symbol.hasInstance` estático faz o `instanceof` perguntar pela marca em vez
 * do protótipo. A marca é não enumerável: não aparece no JSON nem muda a
 * igualdade estrutural dos valores.
 */
const CIVIL_DATE_BRAND = Symbol.for('nestjs-rest-query/CivilDate');
const DECIMAL_VALUE_BRAND = Symbol.for('nestjs-rest-query/DecimalValue');

/** `true` quando `value` foi construído por qualquer cópia da classe marcada. */
export function hasBrand(value: unknown, brand: symbol): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<symbol, unknown>)[brand] === true
  );
}

function brand(target: object, symbol: symbol): void {
  Object.defineProperty(target, symbol, { value: true });
}

/**
 * Data civil sem fuso. Nunca é convertida para instante: `1815-12-10` é o
 * mesmo dia em qualquer timezone de sessão (spec §10.1).
 */
export class CivilDate {
  static [Symbol.hasInstance](value: unknown): boolean {
    return hasBrand(value, CIVIL_DATE_BRAND);
  }

  constructor(readonly iso: string) {
    brand(this, CIVIL_DATE_BRAND);
    Object.freeze(this);
  }

  toString(): string {
    return this.iso;
  }

  toJSON(): string {
    return this.iso;
  }
}

/**
 * Decimal de precisão arbitrária mantido como string canônica. Nunca passa por
 * `number`, então `12345678901234567890.123456` sobrevive ao round-trip.
 */
export class DecimalValue {
  static [Symbol.hasInstance](value: unknown): boolean {
    return hasBrand(value, DECIMAL_VALUE_BRAND);
  }

  constructor(readonly value: string) {
    brand(this, DECIMAL_VALUE_BRAND);
    Object.freeze(this);
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }
}

export type LogicalValue =
  | string
  | number
  | bigint
  | boolean
  | CivilDate
  | DecimalValue
  | Date
  | Uint8Array
  | null;

export type JsonScalar =
  | string
  | number
  | boolean
  | null
  | { readonly [key: string]: unknown }
  | readonly unknown[];
