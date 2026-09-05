import type { QuerySchema, SchemaRegistry } from '../schema';
import type {
  PlanFilter,
  PlanPagination,
  PlanSearch,
  PlanSort,
} from '../semantic-validator';

export interface PlanProjection {
  readonly root: readonly string[];
  readonly relations: ReadonlyMap<string, readonly string[]>;
}

export type TextProfile = 'portable-strict' | 'database-native';
export type ConsistencyMode = 'eventual' | 'transactional';

/**
 * Plano final: tudo o que o compiler precisa, nada que dependa de ORM.
 *
 * `projection` é o que o cliente vê; `internalProjection` é o que o adapter
 * precisa selecionar, incluindo PKs de hidratação e deduplicação que são
 * removidas do JSON depois (spec §13).
 */
export interface TypedQueryPlan {
  readonly model: string;
  readonly registry: SchemaRegistry;
  readonly schema: QuerySchema;
  readonly filters: readonly PlanFilter[];
  readonly search: PlanSearch | null;
  readonly sorts: readonly PlanSort[];
  readonly tieBreak: readonly PlanSort[];
  readonly projection: PlanProjection;
  readonly internalProjection: PlanProjection;
  readonly includes: readonly string[];
  readonly pagination: PlanPagination;
  readonly textProfile: TextProfile;
  readonly consistency: ConsistencyMode;
}
