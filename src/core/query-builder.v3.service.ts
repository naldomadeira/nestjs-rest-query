import { Inject, Injectable, Optional } from '@nestjs/common';
import { DQB_CONFIG_TOKEN } from './constants';
import type {
  CustomizeScope,
  QueryBuilderConfigV3,
  QuerySource,
} from '@contracts/v3';
import type { CompiledQueryRules } from './authorization';
import { inputError, RestQueryError, toHttpException } from './errors';
import { buildQueryPlan, freezePlan, type TypedQueryPlan } from './query-plan';
import {
  normalizeResult,
  type NormalizedQueryResult,
} from './result-normalizer';
import type { QueryInputLike } from './query-parser';
import { StructuredLogger } from '@infra/structured-logger';

export interface ExecuteOptions<TNative = unknown> {
  /**
   * Hook comum a todos os adapters: tenant, soft delete, políticas internas.
   * Roda antes do congelamento, então é a última chance de alterar o plano.
   */
  transformPlan?: (plan: TypedQueryPlan) => TypedQueryPlan;
  /**
   * Hook específico do adapter, para capacidades fora do contrato REST.
   * Recebe o contexto nativo — no TypeORM, o `SelectQueryBuilder` — uma vez
   * por query do escopo.
   */
  customize?: (native: TNative) => void;
  /** @default 'both' — o default seguro (spec §16). */
  customizeScope?: CustomizeScope;
}

/**
 * Ponto de entrada do v3.
 *
 * A ordem é fixa: plano -> transformPlan -> congelamento -> compile ->
 * customize -> execute -> normalização. Data e count derivam do mesmo plano
 * congelado, então as duas queries descrevem sempre a mesma pergunta.
 */
@Injectable()
export class QueryBuilderService {
  private readonly logger: StructuredLogger;

  constructor(
    @Optional()
    @Inject(DQB_CONFIG_TOKEN)
    private readonly config: QueryBuilderConfigV3 = {}
  ) {
    this.logger = new StructuredLogger(config?.logging ?? {});
  }

  buildPlan(
    query: QueryInputLike,
    rules: CompiledQueryRules,
    options: ExecuteOptions = {}
  ): TypedQueryPlan {
    const plan = buildQueryPlan(query, rules, {
      pagination: this.config.pagination,
      textProfile: this.config.textProfile,
      consistency: this.config.consistency,
    });

    return freezePlan(options.transformPlan?.(plan) ?? plan);
  }

  async execute<TSource, TCompiled, TRow, TNative>(
    source: QuerySource<TSource, TCompiled, TRow, TNative>,
    query: QueryInputLike,
    rules: CompiledQueryRules,
    options: ExecuteOptions<TNative> = {}
  ): Promise<NormalizedQueryResult<TRow>> {
    try {
      const plan = this.buildPlan(query, rules, options as ExecuteOptions);

      this.assertConsistencySupported(source, plan);
      this.logPlan(source, plan);

      const compiled = source.adapter.compile(plan, source.input);

      if (options.customize) {
        const scope = options.customizeScope ?? 'both';
        if (scope !== 'both') {
          // Customização que não atinge as duas queries pode fazer o count
          // descrever uma pergunta diferente da dos dados (spec §16).
          this.logger.warn(
            'customize is scoped to a single query; data and count may diverge',
            { scope, adapter: source.kind, model: plan.model }
          );
        }
        source.adapter.customize(compiled, options.customize, scope);
      }

      const result = await source.adapter.execute(compiled);
      return normalizeResult<TRow>(result.rows, result.total, plan);
    } catch (error) {
      if (error instanceof RestQueryError) throw toHttpException(error);
      throw error;
    }
  }

  private assertConsistencySupported<TSource, TCompiled, TRow, TNative>(
    source: QuerySource<TSource, TCompiled, TRow, TNative>,
    plan: TypedQueryPlan
  ): void {
    if (plan.consistency !== 'transactional') return;

    if (!source.adapter.capabilities(source.input).transactionalConsistency) {
      throw inputError(
        'CAPABILITY_UNAVAILABLE',
        `Adapter ${source.kind} cannot guarantee transactional consistency`,
        { adapter: source.kind }
      );
    }
  }

  /** Só metadados: paths, operadores e contagens, nunca valores. */
  private logPlan<TSource, TCompiled, TRow, TNative>(
    source: QuerySource<TSource, TCompiled, TRow, TNative>,
    plan: TypedQueryPlan
  ): void {
    this.logger.debug('executing query plan', {
      adapter: source.kind,
      model: plan.model,
      filters: plan.filters.map((f) => `${f.path}:${f.operator}`),
      sorts: plan.sorts.map((s) => `${s.path}:${s.direction}`),
      includes: plan.includes,
      searchFields: plan.search?.targets.map((t) => t.path) ?? [],
      page: plan.pagination.page,
      perPage: plan.pagination.perPage,
      paginate: plan.pagination.paginate,
    });
  }
}
