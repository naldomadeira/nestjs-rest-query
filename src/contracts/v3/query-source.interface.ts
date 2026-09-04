import type { RestQueryAdapterV3 } from './rest-query-adapter.v3.interface';

/**
 * Source discriminada (spec §8.1).
 *
 * Carrega adapter, entrada nativa e discriminante juntos, o que permite
 * `execute()` inferir o tipo da linha e o do callback de `customize` sem cast
 * no uso público.
 */
export interface QuerySource<TSource, TCompiled, TRow> {
  readonly kind: 'typeorm' | 'prisma' | 'drizzle';
  readonly adapter: RestQueryAdapterV3<TSource, TCompiled, TRow>;
  readonly input: TSource;
}

/** Qualquer source, para posições onde os parâmetros não importam. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyQuerySource = QuerySource<any, any, any>;
