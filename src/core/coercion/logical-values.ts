/**
 * Data civil sem fuso. Nunca é convertida para instante: `1815-12-10` é o
 * mesmo dia em qualquer timezone de sessão (spec §10.1).
 */
export class CivilDate {
  constructor(readonly iso: string) {
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
  constructor(readonly value: string) {
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
