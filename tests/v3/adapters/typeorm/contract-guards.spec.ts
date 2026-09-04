import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { defineQueryRules } from '@core/authorization';
import { buildQueryPlan } from '@core/query-plan';
import {
  planJoins,
  ROOT_ALIAS,
  type JoinNode,
  type JoinPlan,
} from '@infra/adapters/typeorm';
import { compileFilters } from '@infra/adapters/typeorm/typeorm-filter.compiler';
import { compileProjection } from '@infra/adapters/typeorm/typeorm-projection.compiler';
import { compilePlan } from '@infra/adapters/typeorm';
import { CORPUS_SCHEMAS } from '../../fixtures/schemas';
import { RULES_PRESETS } from '../../fixtures/rules';
import {
  closeSqlite,
  ESCAPE_CHARACTER,
  openSqlite,
  repositoryFor,
} from './helpers';

beforeAll(async () => {
  await openSqlite();
});
afterAll(closeSqlite);

/**
 * Plano de joins vazio: forma válida do tipo, e o pior emparelhamento possível.
 *
 * O compilador recebe plano e plano de joins como duas estruturas separadas —
 * `compilePlan` é quem as casa. Estes testes chamam as etapas com o par
 * desemparelhado porque é a única forma de provar o que acontece se elas
 * divergirem: o adapter tem de falhar alto com `ADAPTER_CONTRACT_VIOLATION`, e
 * não emitir SQL com alias inexistente (erro do driver, no melhor caso) ou com
 * o alias errado (resultado errado e silencioso, no pior).
 */
const noJoins: JoinPlan = {
  rootAlias: ROOT_ALIAS,
  nodes: new Map(),
  hasManyPresentation: false,
};

const queryBuilder = (preset: string): SelectQueryBuilder<ObjectLiteral> =>
  repositoryFor(preset).createQueryBuilder(ROOT_ALIAS);

describe('guardas de contrato entre plano e plano de joins', () => {
  it('filtro pela própria relação recusa plano de joins sem o caminho', () => {
    const plan = buildQueryPlan(
      { filter: { company: { isNull: 'true' } } },
      RULES_PRESETS['user.deep']
    );

    expect(() =>
      compileFilters(queryBuilder('user.deep'), {
        plan,
        joins: noJoins,
        escapeCharacter: ESCAPE_CHARACTER,
      })
    ).toThrow(
      expect.objectContaining({
        code: 'ADAPTER_CONTRACT_VIOLATION',
        message: expect.stringContaining('company'),
      })
    );
  });

  it('coluna por relação recusa plano de joins sem o caminho', () => {
    const plan = buildQueryPlan(
      { filter: { 'company.name': { eq: 'Acme' } } },
      RULES_PRESETS['user.deep']
    );

    expect(() =>
      compileFilters(queryBuilder('user.deep'), {
        plan,
        joins: noJoins,
        escapeCharacter: ESCAPE_CHARACTER,
      })
    ).toThrow(
      expect.objectContaining({
        code: 'ADAPTER_CONTRACT_VIOLATION',
        message: expect.stringContaining('company'),
      })
    );
  });

  it('projeção de relação recusa plano de joins sem o caminho', () => {
    const plan = buildQueryPlan(
      { includes: 'company' },
      RULES_PRESETS['user.deep']
    );

    expect(() =>
      compileProjection(queryBuilder('user.deep'), plan, noJoins)
    ).toThrow(expect.objectContaining({ code: 'ADAPTER_CONTRACT_VIOLATION' }));
  });

  it('join criado só para filtrar não entra no SELECT', () => {
    // É a terceira garantia declarada por `compileProjection`, e a que evita
    // que uma relação usada apenas como predicado apareça no JSON de resposta.
    // Só o plano de joins sabe distinguir os dois usos, então a projeção tem de
    // consultar o nó em vez de confiar no plano lógico.
    const plan = buildQueryPlan(
      { includes: 'company' },
      RULES_PRESETS['user.deep']
    );
    const predicateOnly: JoinPlan = {
      rootAlias: ROOT_ALIAS,
      nodes: new Map<string, JoinNode>([
        [
          'company',
          {
            path: 'company',
            alias: 'root_company',
            parentAlias: ROOT_ALIAS,
            property: 'company',
            cardinality: 'one',
            predicate: true,
            presentation: false,
          },
        ],
      ]),
      hasManyPresentation: false,
    };

    const qb = queryBuilder('user.deep');
    compileProjection(qb, plan, predicateOnly);

    const sql = qb.getQuery();
    expect(sql).toContain('root_id');
    expect(sql).not.toContain('root_company');
  });
});

describe('guardas de contrato do planner', () => {
  it('recusa um plano cujo registry não descreve o caminho pedido', () => {
    // O registry e os caminhos do plano vêm da mesma validação, então divergir
    // significa que núcleo e adapter estão fora de sincronia. O planner tem de
    // dizer isso: se seguisse em frente, criaria um alias para uma relação que
    // o TypeORM não conhece e o join morreria no driver, com mensagem de banco
    // em vez de erro de contrato.
    const plan = buildQueryPlan(
      { includes: 'company' },
      RULES_PRESETS['user.deep']
    );

    expect(() => planJoins({ ...plan, registry: new Map() })).toThrow(
      expect.objectContaining({
        code: 'ADAPTER_CONTRACT_VIOLATION',
        message: expect.stringContaining('company'),
      })
    );
  });
});

describe('limites declarados do filtro existencial', () => {
  it('recusa filtro existencial que cruza duas relações many', () => {
    // `posts.tags.label` exigiria um EXISTS aninhado correlacionado em dois
    // níveis. Enquanto isso não existir, a recusa tem de ser explícita: um
    // EXISTS de um nível só compilaria a correlação errada e devolveria roots
    // que não casam com o filtro pedido.
    const rules = defineQueryRules(CORPUS_SCHEMAS, 'user', {
      filters: [{ path: 'posts.tags.label', operators: ['eq'] }],
      sorts: ['id'],
      fields: { root: { allowed: ['id', 'name'], default: ['id', 'name'] } },
    });
    const plan = buildQueryPlan(
      { filter: { 'posts.tags.label': { eq: 'oss' } } },
      rules
    );

    expect(() =>
      compilePlan(plan, repositoryFor('user.deep'), ESCAPE_CHARACTER)
    ).toThrow(
      expect.objectContaining({
        code: 'CAPABILITY_UNAVAILABLE',
        message: expect.stringContaining('nested many'),
      })
    );
  });
});
