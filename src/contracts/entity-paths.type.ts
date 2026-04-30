/**
 * Tipos primitivos que encerram a recursao de paths.
 */
type Primitive = string | number | bigint | boolean | Date | null | undefined;

/**
 * Gera union de dot-notation paths para uma entidade T.
 * Limite de profundidade: 5 niveis (evita estouro com refs circulares).
 */
type DeepPaths<T, Depth extends number[] = []> = Depth['length'] extends 5
  ? never
  : T extends Primitive
    ? never
    : T extends Array<infer U>
      ? DeepPaths<U, [...Depth, 0]>
      : {
          [K in keyof T & string]:
            | K
            | (NonNullable<T[K]> extends Primitive
                ? never
                : `${K}.${DeepPaths<NonNullable<T[K]>, [...Depth, 0]>}`);
        }[keyof T & string];

/**
 * Paths tipados de uma entidade em dot-notation.
 * Quando T = any, resolve para string (backward-compatible).
 */
export type EntityPaths<T> = DeepPaths<T>;
