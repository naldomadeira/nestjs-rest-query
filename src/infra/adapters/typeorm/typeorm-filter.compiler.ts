import {
  Brackets,
  type SelectQueryBuilder,
  type WhereExpressionBuilder,
} from 'typeorm';
import type { ObjectLiteral } from 'typeorm';
import { configurationError } from '@core/errors';
import { CivilDate, DecimalValue } from '@core/coercion';
import type { PlanFilter } from '@core/semantic-validator';
import type { TypedQueryPlan } from '@core/query-plan';
import { containsPattern } from '../shared/escape-pattern';
import {
  existentialChain,
  ROOT_ALIAS,
  type ExistentialStep,
  type JoinPlan,
} from './typeorm-join-planner';

export interface FilterCompilerContext {
  readonly plan: TypedQueryPlan;
  readonly joins: JoinPlan;
  readonly escapeCharacter: string;
}

/** Contador de parâmetros por query, para nomes estáveis e sem colisão. */
class ParameterBag {
  private index = 0;
  readonly values: Record<string, unknown> = {};

  add(value: unknown): string {
    const key = `dqb_${this.index++}`;
    this.values[key] = value;
    return key;
  }
}

/**
 * Compila filtros e busca para o `SelectQueryBuilder` (spec §11).
 *
 * Nenhum valor é interpolado no SQL: tudo vira parâmetro nomeado. Padrões
 * literais passam pelo escape do dialeto e emitem a cláusula ESCAPE explícita.
 */
export function compileFilters<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  context: FilterCompilerContext
): void {
  const bag = new ParameterBag();

  for (const filter of context.plan.filters) {
    qb.andWhere(
      new Brackets((where) => applyFilter(qb, where, filter, context, bag))
    );
  }

  const search = context.plan.search;
  if (search && search.targets.length > 0) {
    // Search combina seus campos com OR e entra como mais um termo do AND.
    //
    // Existencial e não existencial convivem no mesmo OR: a busca é uma só
    // pergunta ("algum destes lugares contém o termo"), e separá-la em dois
    // grupos a transformaria num AND de duas buscas.
    qb.andWhere(
      new Brackets((where) => {
        for (const target of search.targets) {
          const key = bag.add(
            containsPattern(search.foldedTerm, context.escapeCharacter)
          );
          const like = (column: string): string =>
            `${column} LIKE :${key} ESCAPE '${context.escapeCharacter}'`;

          where.orWhere(
            target.existential
              ? existsThroughMany(qb, target.relationPath, (alias) =>
                  like(`${alias}.${leafColumn(target.column)}`)
                )
              : like(columnRef(target.column, context))
          );
        }
      })
    );
  }

  qb.setParameters(bag.values);
}

function applyFilter<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  where: WhereExpressionBuilder,
  filter: PlanFilter,
  context: FilterCompilerContext,
  bag: ParameterBag
): void {
  if (filter.alwaysFalse) {
    where.andWhere('1 = 0');
    return;
  }
  if (filter.alwaysTrue) {
    where.andWhere('1 = 1');
    return;
  }

  if (filter.existential) {
    where.andWhere(existentialCondition(qb, filter, context, bag));
    return;
  }

  if (filter.target === 'relation') {
    // Relação `one`: presença/ausência é a nulidade da chave estrangeira, que
    // o join à esquerda expõe pela PK do alias juntado.
    const node = context.joins.nodes.get(filter.path);
    if (!node) {
      throw configurationError(
        'ADAPTER_CONTRACT_VIOLATION',
        `Relation filter ${filter.path} has no planned join`,
        { path: filter.path }
      );
    }
    const targetModel = relationTargetModel(context.plan, filter.path);
    const pk = context.plan.registry.get(targetModel)!.primaryKey[0];
    where.andWhere(
      `${node.alias}.${pk} IS ${filter.value === true ? '' : 'NOT '}NULL`
    );
    return;
  }

  const column = columnRef(filter.column, context);

  switch (filter.operator) {
    case 'isNull':
      where.andWhere(`${column} IS ${filter.value === true ? '' : 'NOT '}NULL`);
      return;

    case 'in':
    case 'notIn': {
      const key = bag.add((filter.value as unknown[]).map(toDriverValue));
      where.andWhere(
        `${column} ${filter.operator === 'in' ? 'IN' : 'NOT IN'} (:...${key})`
      );
      return;
    }

    case 'between': {
      const [from, to] = filter.value as unknown[];
      const fromKey = bag.add(toDriverValue(from));
      const toKey = bag.add(toDriverValue(to));
      where.andWhere(`${column} BETWEEN :${fromKey} AND :${toKey}`);
      return;
    }

    case 'like':
    case 'notLike':
    case 'ilike':
    case 'notIlike': {
      const key = bag.add(
        containsPattern(filter.value as string, context.escapeCharacter)
      );
      const negated =
        filter.operator === 'notLike' || filter.operator === 'notIlike';
      where.andWhere(
        `${column} ${negated ? 'NOT LIKE' : 'LIKE'} :${key} ESCAPE '${context.escapeCharacter}'`
      );
      return;
    }

    default: {
      const key = bag.add(toDriverValue(filter.value));
      where.andWhere(`${column} ${SQL_COMPARISON[filter.operator]} :${key}`);
    }
  }
}

const SQL_COMPARISON: Readonly<Record<string, string>> = {
  eq: '=',
  ne: '<>',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
};

/**
 * Filtro por relação `many`: "algum item corresponde" (spec §11.1).
 *
 * Um join inflaria os roots e quebraria `total`, então a condição vira uma
 * subquery correlacionada pela PK do root.
 */
function existentialCondition<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  filter: PlanFilter,
  context: FilterCompilerContext,
  bag: ParameterBag
): string {
  const exists = existsThroughMany(
    qb,
    filter.relationPath,
    // Alvo é a própria relação: a condição é só a correlação, sem folha.
    filter.target === 'relation'
      ? null
      : (alias) =>
          existentialLeafCondition(
            `${alias}.${leafColumn(filter.column)}`,
            filter,
            context,
            bag
          )
  );

  // `isNull=true` numa relação many significa coleção vazia.
  return filter.target === 'relation' && filter.value === true
    ? `NOT ${exists}`
    : exists;
}

/**
 * `EXISTS` correlacionado por um caminho que cruza `many`, de qualquer
 * profundidade.
 *
 * É a mesma maquinaria para filtro e para busca — inclusive a correlação por
 * FK composta —, porque a semântica é a mesma: "algum item corresponde". O
 * chamador só fornece a condição da folha, já qualificada pelo alias da
 * subquery, ou `null` quando a pergunta é sobre a própria coleção.
 *
 * A correlação com o root acontece **uma só vez**, no primeiro salto; os
 * saltos seguintes são `INNER JOIN` dentro da subquery. Correlacionar cada
 * salto por fora traria a coleção para o `FROM` externo, inflaria os roots e
 * estragaria o `total` — o problema que o `EXISTS` resolve.
 */
function existsThroughMany<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  relationPath: readonly string[],
  leaf: ((subAlias: string) => string) | null
): string {
  const [head, ...tail] = existentialChain(
    qb.expressionMap.mainAlias!.metadata,
    relationPath
  );

  const correlation = linkCondition(head, ROOT_ALIAS);

  // Cada passo se liga ao alias imediatamente anterior — inclusive a tabela de
  // junção de uma many-to-many, que é um passo como os outros.
  const joins: string[] = [];
  let parentAlias = head.alias;
  for (const step of tail) {
    joins.push(
      ` INNER JOIN ${step.table} ${step.alias} ON ${linkCondition(step, parentAlias)}`
    );
    parentAlias = step.alias;
  }

  const conditions = [correlation];
  // A folha é sempre qualificada pelo último alias da cadeia: é lá que a
  // coluna do filtro (ou da busca) mora.
  if (leaf) conditions.push(leaf(parentAlias));

  return `EXISTS (SELECT 1 FROM ${head.table} ${head.alias}${joins.join('')} WHERE ${conditions.join(' AND ')})`;
}

/** Igualdade entre as colunas de um passo e as do alias anterior. */
function linkCondition(step: ExistentialStep, parentAlias: string): string {
  return step.on
    .map(
      (pair) =>
        `${step.alias}.${pair.column} = ${parentAlias}.${pair.parentColumn}`
    )
    .join(' AND ');
}

function existentialLeafCondition(
  column: string,
  filter: PlanFilter,
  context: FilterCompilerContext,
  bag: ParameterBag
): string {
  switch (filter.operator) {
    case 'isNull':
      return `${column} IS ${filter.value === true ? '' : 'NOT '}NULL`;

    case 'in':
    case 'notIn': {
      const key = bag.add((filter.value as unknown[]).map(toDriverValue));
      return `${column} ${filter.operator === 'in' ? 'IN' : 'NOT IN'} (:...${key})`;
    }

    case 'between': {
      const [from, to] = filter.value as unknown[];
      const fromKey = bag.add(toDriverValue(from));
      const toKey = bag.add(toDriverValue(to));
      return `${column} BETWEEN :${fromKey} AND :${toKey}`;
    }

    case 'like':
    case 'notLike':
    case 'ilike':
    case 'notIlike': {
      const key = bag.add(
        containsPattern(filter.value as string, context.escapeCharacter)
      );
      const negated =
        filter.operator === 'notLike' || filter.operator === 'notIlike';
      return `${column} ${negated ? 'NOT LIKE' : 'LIKE'} :${key} ESCAPE '${context.escapeCharacter}'`;
    }

    default: {
      const key = bag.add(toDriverValue(filter.value));
      return `${column} ${SQL_COMPARISON[filter.operator]} :${key}`;
    }
  }
}

/** Última parte de um path pontuado: a coluna física da folha. */
function leafColumn(column: string): string {
  return column.slice(column.lastIndexOf('.') + 1);
}

/** Referência SQL de uma coluna lógica, resolvendo o alias do join. */
export function columnRef(
  column: string,
  context: FilterCompilerContext
): string {
  if (!column.includes('.')) return `${ROOT_ALIAS}.${column}`;

  const relationPath = column.slice(0, column.lastIndexOf('.'));
  const leaf = column.slice(column.lastIndexOf('.') + 1);
  const node = context.joins.nodes.get(relationPath);

  if (!node) {
    throw configurationError(
      'ADAPTER_CONTRACT_VIOLATION',
      `No planned join for relation path ${relationPath}`,
      { path: column }
    );
  }
  return `${node.alias}.${leaf}`;
}

function relationTargetModel(plan: TypedQueryPlan, path: string): string {
  const segments = path.split('.');
  let model = plan.model;
  for (const segment of segments) {
    model = plan.registry.get(model)!.relations.get(segment)!.target;
  }
  return model;
}

/** Valores lógicos viram o tipo que o driver entende. */
function toDriverValue(value: unknown): unknown {
  if (value instanceof CivilDate) return value.iso;
  if (value instanceof DecimalValue) return value.value;
  if (typeof value === 'bigint') return value.toString();
  return value;
}
