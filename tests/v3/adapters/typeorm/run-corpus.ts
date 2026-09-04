import { QueryBuilderService } from '@core/query-builder.v3.service';
import { typeormSource } from '@infra/adapters/typeorm';
import type { CorpusCase } from '../../corpus/corpus.types';
import { RULES_PRESETS } from '../../fixtures/rules';
import { repositoryFor } from './helpers';

export interface CorpusOutcome {
  kind: 'rows' | 'error';
  ids?: (string | number)[];
  total?: number;
  lastPage?: number;
  firstRow?: Record<string, unknown>;
  status?: number;
  code?: string;
}

const service = new QueryBuilderService({});

/** Chave observável de um root: PK simples, ou partes unidas por `|`. */
function rootKey(
  row: Record<string, unknown>,
  primaryKey: readonly string[]
): string | number {
  if (primaryKey.length === 1) return row[primaryKey[0]] as string | number;
  return primaryKey.map((column) => String(row[column])).join('|');
}

/**
 * Roda um caso do corpus e reduz o resultado à forma comparável.
 *
 * A mesma redução é usada pelos contract tests e pela integração real, de modo
 * que a comparação entre células seja de dados, não de comportamento
 * reimplementado por adapter.
 */
export async function runCorpusCase(
  testCase: CorpusCase
): Promise<CorpusOutcome> {
  const rules = RULES_PRESETS[testCase.rules];
  const repository = repositoryFor(testCase.rules);

  // Casos de projeção pedem a PK para que a comparação de IDs funcione mesmo
  // quando o cliente não a projetou.
  const primaryKey = rules.registry.get(rules.model)!.primaryKey;

  try {
    const result = await service.execute(
      typeormSource(repository),
      testCase.query,
      rules
    );

    const rows = result.data as Record<string, unknown>[];

    return {
      kind: 'rows',
      ids: rows.map((row) => rootKey(row, primaryKey)),
      total: result.total,
      lastPage: result.lastPage,
      firstRow: rows[0],
    };
  } catch (error) {
    const response = (
      error as { getResponse?: () => { statusCode: number; code: string } }
    ).getResponse?.();

    if (!response) throw error;
    return { kind: 'error', status: response.statusCode, code: response.code };
  }
}
