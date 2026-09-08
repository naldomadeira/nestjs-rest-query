import { defineQueryRules, type CompiledQueryRules } from '@core/authorization';
import { buildQueryPlan } from '@core/query-plan';
import { compilePlan, planJoins } from '@infra/adapters/typeorm';
import { CORPUS_SCHEMAS } from '../../fixtures/schemas';
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
 * Regras que autorizam ordenação e busca **por caminho de relação**.
 *
 * As regras compartilhadas do corpus só ordenam e buscam por colunas do root,
 * então o planner nunca era chamado a criar um join a partir de um `sort` ou de
 * um alvo de `search` — só de filtro e de include. São três origens de join
 * diferentes convergindo no mesmo mapa de nós, e é a convergência que este
 * arquivo trava.
 */
function relationOrderRules(): CompiledQueryRules {
  return defineQueryRules(CORPUS_SCHEMAS, 'user', {
    filters: [{ path: 'id', operators: ['eq'] }],
    sorts: ['id', 'company.name'],
    fields: {
      root: { allowed: ['id', 'name'], default: ['id', 'name'] },
      relations: {
        company: { allowed: ['id', 'name'], default: ['id', 'name'] },
      },
    },
    includes: ['company'],
    search: ['name', 'company.name'],
  });
}

/**
 * Regras que buscam por uma folha **através de uma relação `many`**.
 *
 * `posts` fica fora de `includes` de propósito: sem join de apresentação, a
 * consulta de dados é um SELECT único com LIMIT, que é exatamente onde um join
 * de predicado por `many` encurtaria a página.
 */
function searchThroughManyRules(): CompiledQueryRules {
  return defineQueryRules(CORPUS_SCHEMAS, 'user', {
    filters: [{ path: 'id', operators: ['eq'] }],
    sorts: ['id'],
    fields: { root: { allowed: ['id', 'name'], default: ['id', 'name'] } },
    search: ['name', 'posts.title'],
  });
}

function compileWith(
  rules: CompiledQueryRules,
  query: Record<string, unknown>
): { sql: string; countSql: string } {
  const plan = buildQueryPlan(query, rules);
  const compiled = compilePlan(
    plan,
    repositoryFor('user.default'),
    ESCAPE_CHARACTER
  );
  return {
    sql: compiled.data.getQuery().replace(/"/g, ''),
    countSql: compiled.count.getQuery().replace(/"/g, ''),
  };
}

function compile(query: Record<string, unknown>): {
  sql: string;
  countSql: string;
} {
  return compileWith(relationOrderRules(), query);
}

describe('origens de join no planner', () => {
  it('sort por coluna de relação cria o join que o ORDER BY precisa', () => {
    const { sql } = compile({ sort: 'company.name' });

    expect(sql).toContain('LEFT JOIN companies root_company');
    expect(sql).toMatch(/ORDER BY root_company\.name ASC/);
  });

  it('o join de um sort é de predicado, então o count também o carrega', () => {
    // Ordenar por coluna de relação com LEFT JOIN não muda a contagem de
    // roots (cardinalidade `one`), mas o nó tem de ser marcado como predicado:
    // classificá-lo como apresentação o tiraria do count e, pior, o colocaria
    // na projeção — a relação apareceria no JSON sem ninguém a ter incluído.
    const { sql, countSql } = compile({ sort: 'company.name' });

    expect(countSql).toContain('LEFT JOIN companies root_company');
    expect(sql).not.toContain('root_company_name AS');
  });

  it('alvo de search por relação cria o join e entra no OR da busca', () => {
    const { sql } = compile({ search: 'ada' });

    expect(sql).toContain('LEFT JOIN companies root_company');
    expect(sql).toMatch(
      /root\.name_folded LIKE :dqb_0[\s\S]*OR root_company\.name_folded LIKE :dqb_1/
    );
  });

  it('sort, search e include no mesmo caminho reutilizam um único join', () => {
    // Aliases derivados do path é o que torna a reutilização possível; se cada
    // origem criasse o seu, o mesmo root viria multiplicado pelo número de
    // joins repetidos.
    const { sql } = compile({
      sort: 'company.name',
      search: 'ada',
      includes: 'company',
    });

    expect(sql.match(/LEFT JOIN/g)).toHaveLength(1);
  });

  it('alvo de search por relação many não vira join: vira EXISTS no mesmo OR', () => {
    // O bug que este teste tranca: o planner criava um join de predicado para
    // o alvo `posts.title` e o compilador comparava a coluna do alias juntado.
    // O root vinha repetido uma vez por post casado, o LIMIT da página caía
    // sobre as duplicatas e a página saía curta — com `total` certo, porque
    // `getCount()` conta roots distintos. O EXISTS devolve uma linha por root.
    const { sql, countSql } = compileWith(searchThroughManyRules(), {
      search: 'ada',
    });

    expect(sql).not.toMatch(/JOIN/i);
    expect(sql).toMatch(
      new RegExp(
        `root\\.name_folded LIKE :dqb_0[\\s\\S]*OR EXISTS \\(SELECT 1 FROM posts dqb_ex_posts WHERE dqb_ex_posts\\.user_id = root\\.id AND dqb_ex_posts\\.title_folded LIKE :dqb_1 ESCAPE '${ESCAPE_CHARACTER}'\\)`
      )
    );
    // O count nasce dos mesmos predicados: se o join voltasse, voltaria aqui.
    expect(countSql).not.toMatch(/JOIN/i);
  });

  it('um caminho que serve a predicado e a apresentação acumula os dois usos', () => {
    const plan = buildQueryPlan(
      { sort: 'company.name', includes: 'company' },
      relationOrderRules()
    );
    const node = planJoins(plan).nodes.get('company')!;

    expect(node.predicate).toBe(true);
    expect(node.presentation).toBe(true);
  });
});
