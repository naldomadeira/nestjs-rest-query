import { Inject, Injectable, Optional } from '@nestjs/common';
import { DQB_CONFIG_TOKEN } from './constants';
import type {
  CustomizeScope,
  QueryBuilderConfigV3,
  QuerySource,
} from '@contracts/v3';
import type { CompiledQueryRules } from './authorization';
import {
  configurationError,
  inputError,
  RestQueryError,
  toHttpException,
} from './errors';
import { buildQueryPlan, freezePlan, type TypedQueryPlan } from './query-plan';
import {
  normalizeResult,
  type NormalizedQueryResult,
} from './result-normalizer';
import type {
  FieldDescriptor,
  QuerySchema,
  RelationDescriptor,
} from './schema';
import { checkPortabilityProfile } from './portability';
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
  private readonly sourceSchemaCache = new WeakMap<
    object,
    Promise<QuerySchema>
  >();

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

      await this.assertSourceMatchesRules(source, plan);
      this.assertPortabilityProfile(source, plan);
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

  private assertPortabilityProfile<TSource, TCompiled, TRow, TNative>(
    source: QuerySource<TSource, TCompiled, TRow, TNative>,
    plan: TypedQueryPlan
  ): void {
    if (!this.config.portability?.enforce) return;
    if (plan.textProfile !== 'portable-strict') return;

    if (!source.portabilityProfile) {
      throw configurationError(
        'PORTABILITY_PROFILE_MISMATCH',
        `Source ${source.kind} has no portability profile facts`,
        { adapter: source.kind }
      );
    }

    const capabilities = source.adapter.capabilities(source.input);
    if (capabilities.dialect !== source.portabilityProfile.dialect) {
      throw configurationError(
        'PORTABILITY_PROFILE_MISMATCH',
        `Source dialect ${capabilities.dialect} does not match portability profile ${source.portabilityProfile.dialect}`,
        {
          adapter: source.kind,
          expected: capabilities.dialect,
          actual: source.portabilityProfile.dialect,
        }
      );
    }

    const violations = checkPortabilityProfile(source.portabilityProfile);
    if (violations.length > 0) {
      throw configurationError(
        'PORTABILITY_PROFILE_MISMATCH',
        `Source ${source.kind} does not match the certified portability profile`,
        { adapter: source.kind, violations }
      );
    }
  }

  private async assertSourceMatchesRules<TSource, TCompiled, TRow, TNative>(
    source: QuerySource<TSource, TCompiled, TRow, TNative>,
    plan: TypedQueryPlan
  ): Promise<void> {
    const actual = await this.describeSource(source);
    const expected = plan.schema;

    if (actual.model !== expected.model) {
      throw inputError(
        'SOURCE_CONFIGURATION_INVALID',
        `Source model ${actual.model} does not match query rules model ${expected.model}`,
        { adapter: source.kind, expected: expected.model, actual: actual.model }
      );
    }

    assertSameList(
      source.kind,
      'primaryKey',
      expected.primaryKey,
      actual.primaryKey
    );

    for (const field of expected.fields.values()) {
      const actualField = actual.fields.get(field.path);
      if (!actualField) {
        throw sourceMismatch(
          source.kind,
          `Missing source field ${field.path}`,
          {
            path: field.path,
          }
        );
      }
      assertField(source.kind, field, actualField);
    }

    for (const relation of expected.relations.values()) {
      const actualRelation = actual.relations.get(relation.path);
      if (!actualRelation) {
        throw sourceMismatch(
          source.kind,
          `Missing source relation ${relation.path}`,
          { path: relation.path }
        );
      }
      assertRelation(source.kind, relation, actualRelation);
    }
  }

  private describeSource<TSource, TCompiled, TRow, TNative>(
    source: QuerySource<TSource, TCompiled, TRow, TNative>
  ): Promise<QuerySchema> {
    const cached = this.sourceSchemaCache.get(source);
    if (cached) return cached;

    const description = source.adapter.describe(source.input);
    this.sourceSchemaCache.set(source, description);
    return description;
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

function sourceMismatch(
  adapter: string,
  message: string,
  details: Record<string, unknown>
): never {
  throw configurationError('SOURCE_CONFIGURATION_INVALID', message, {
    adapter,
    ...details,
  });
}

function assertSameList(
  adapter: string,
  path: string,
  expected: readonly string[],
  actual: readonly string[]
): void {
  if (
    expected.length === actual.length &&
    expected.every((value, index) => value === actual[index])
  ) {
    return;
  }

  sourceMismatch(adapter, `Source ${path} does not match query rules`, {
    path,
    expected,
    actual,
  });
}

function assertField(
  adapter: string,
  expected: FieldDescriptor,
  actual: FieldDescriptor
): void {
  for (const key of [
    'kind',
    'nullable',
    'primaryKey',
    'foldedField',
    'portableOrderField',
    'internal',
  ] as const) {
    if ((expected[key] ?? false) === (actual[key] ?? false)) continue;
    sourceMismatch(
      adapter,
      `Source field ${expected.path} does not match query rules`,
      {
        path: expected.path,
        property: key,
        expected: expected[key],
        actual: actual[key],
      }
    );
  }
}

function assertRelation(
  adapter: string,
  expected: RelationDescriptor,
  actual: RelationDescriptor
): void {
  for (const key of ['target', 'cardinality', 'nullable'] as const) {
    if (expected[key] === actual[key]) continue;
    sourceMismatch(
      adapter,
      `Source relation ${expected.path} does not match query rules`,
      {
        path: expected.path,
        property: key,
        expected: expected[key],
        actual: actual[key],
      }
    );
  }
}
