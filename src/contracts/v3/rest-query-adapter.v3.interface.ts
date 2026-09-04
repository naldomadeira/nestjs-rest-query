import type { TypedQueryPlan } from '../../core/query-plan';
import type { QuerySchema } from '../../core/schema';
import type { AdapterCapabilities } from './adapter-capabilities.interface';

export interface AdapterResult<TRow> {
  /** Linhas já hidratadas em forma aninhada, ainda com colunas internas. */
  readonly rows: readonly TRow[];
  /** Ausente quando o plano pediu `paginate=false`. */
  readonly total?: number;
  /** Quantas queries foram emitidas; usado pelos testes de orçamento. */
  readonly queryCount?: number;
}

export type CustomizeScope = 'data' | 'count' | 'both';

/**
 * Contrato dos adapters (spec §15).
 *
 * Difere do design aprovado num ponto: `normalize()` não está aqui. Mantê-lo
 * no adapter permitiria três normalizações divergentes, que é exatamente o que
 * a §5.4 proíbe. O adapter hidrata (`AdapterResult`) e o núcleo produz o JSON
 * canônico para os três. Registrado no migration guide.
 */
/**
 * `TNative` é o contexto que `customize` entrega ao consumidor — para o
 * TypeORM, o `SelectQueryBuilder` (spec §15.1). É distinto de `TCompiled`
 * porque um plano compila para *duas* queries, data e count, e o callback age
 * sobre uma de cada vez.
 */
export interface RestQueryAdapterV3<
  TSource,
  TCompiled,
  TRow,
  TNative = TCompiled,
> {
  readonly id: 'typeorm' | 'prisma' | 'drizzle';

  /** Deriva o schema lógico a partir da metadata da source. */
  describe(source: TSource): Promise<QuerySchema>;

  capabilities(source: TSource): AdapterCapabilities;

  compile(plan: TypedQueryPlan, source: TSource): TCompiled;

  /**
   * Aplica o callback ao contexto nativo, uma vez por query do escopo.
   *
   * Chamar uma vez por query — em vez de entregar as duas juntas — é o que faz
   * `both`, o default seguro, realmente atingir data e count com um único
   * `qb.andWhere(...)`.
   */
  customize(
    compiled: TCompiled,
    callback: (native: TNative) => void,
    scope?: CustomizeScope
  ): void;

  execute(compiled: TCompiled): Promise<AdapterResult<TRow>>;
}
