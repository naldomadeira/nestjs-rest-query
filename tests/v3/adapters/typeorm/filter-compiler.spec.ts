import { closeSqlite, compileToQueryBuilder, openSqlite } from './helpers';

beforeAll(async () => {
  await openSqlite();
});
afterAll(closeSqlite);

describe('compilação de filtros TypeORM', () => {
  it('cria join para filter por relação sem includes', () => {
    const { sql } = compileToQueryBuilder({
      filter: { 'company.name': { eq: 'Acme' } },
    });
    expect(sql).toMatch(/LEFT JOIN/i);
    expect(sql).toMatch(/root_company/);
  });

  it('usa o mesmo alias para o mesmo caminho em filtro e include', () => {
    const { sql } = compileToQueryBuilder({
      filter: { 'company.name': { eq: 'Acme' } },
      includes: 'company',
    });
    expect(sql.match(/LEFT JOIN/gi)).toHaveLength(1);
  });

  it('aliases profundos são determinísticos e não colidem', () => {
    const { sql } = compileToQueryBuilder(
      { includes: 'company,company.owner' },
      'user.deep'
    );
    expect(sql).toContain('root_company_owner');
    expect(sql.match(/LEFT JOIN/gi)).toHaveLength(2);
  });

  it('relação many em filtro vira EXISTS, não join que infla roots', () => {
    const { sql } = compileToQueryBuilder(
      { filter: { 'posts.title': { eq: 'a' } } },
      'user.deep'
    );
    expect(sql).toMatch(/EXISTS \(SELECT 1 FROM posts/i);
    expect(sql).not.toMatch(/LEFT JOIN .*posts/i);
  });

  it('escapa %, _ e barra invertida em like', () => {
    const { parameters } = compileToQueryBuilder({
      filter: { name: { like: '100%_\\' } },
    });
    expect(Object.values(parameters)[0]).toBe('%100!%!_\\%');
  });

  it('emite a cláusula ESCAPE explícita', () => {
    const { sql } = compileToQueryBuilder({ filter: { name: { like: 'a' } } });
    expect(sql).toMatch(/LIKE :dqb_0 ESCAPE '!'/);
  });

  it('ilike consulta a coluna folded e não emite ILIKE', () => {
    const { sql, parameters } = compileToQueryBuilder({
      filter: { name: { ilike: 'AÇÃO' } },
    });
    expect(sql).toMatch(/name_folded/);
    expect(sql).not.toMatch(/ILIKE/i);
    expect(Object.values(parameters)[0]).toBe('%ação%');
  });

  it('in vazio compila para condição sempre falsa', () => {
    const { sql } = compileToQueryBuilder({ filter: { id: { in: [] } } });
    expect(sql).toMatch(/1 = 0/);
  });

  it('notIn vazio compila para condição sempre verdadeira', () => {
    const { sql } = compileToQueryBuilder({ filter: { id: { notIn: [] } } });
    expect(sql).toMatch(/1 = 1/);
  });

  it('between vira BETWEEN com dois parâmetros', () => {
    const { sql, parameters } = compileToQueryBuilder({
      filter: { id: { between: '2,4' } },
    });
    expect(sql).toMatch(/BETWEEN :dqb_0 AND :dqb_1/);
    expect(parameters).toEqual({ dqb_0: 2, dqb_1: 4 });
  });

  it('isNull em relação one vira nulidade da PK do join', () => {
    const { sql } = compileToQueryBuilder(
      { filter: { company: { isNull: 'true' } } },
      'user.deep'
    );
    expect(sql).toMatch(/"?root_company"?\."?id"? IS NULL/);
  });

  it('isNull=true em relação many vira NOT EXISTS', () => {
    const { sql } = compileToQueryBuilder(
      { filter: { posts: { isNull: 'true' } } },
      'user.deep'
    );
    expect(sql).toMatch(/NOT EXISTS \(SELECT 1 FROM posts/i);
  });

  it('isNull=false em relação many vira EXISTS', () => {
    const { sql } = compileToQueryBuilder(
      { filter: { posts: { isNull: 'false' } } },
      'user.deep'
    );
    expect(sql).toMatch(/EXISTS \(SELECT 1 FROM posts/i);
    expect(sql).not.toMatch(/NOT EXISTS/i);
  });

  it('search combina campos com OR dentro de um termo do AND', () => {
    const { sql } = compileToQueryBuilder({
      search: 'ada',
      filter: { active: { eq: 'true' } },
    });
    expect(sql).toMatch(/name_folded[^)]*OR[^)]*email_folded/is);
  });

  it('bigint chega ao driver como string decimal', () => {
    const { parameters } = compileToQueryBuilder({
      filter: { score: { eq: '9007199254740993' } },
    });
    expect(parameters.dqb_0).toBe('9007199254740993');
  });

  it('decimal chega ao driver como string canônica', () => {
    const { parameters } = compileToQueryBuilder({
      filter: { balance: { eq: '1.50' } },
    });
    expect(parameters.dqb_0).toBe('1.50');
  });

  it('date chega ao driver como YYYY-MM-DD', () => {
    const { parameters } = compileToQueryBuilder({
      filter: { born_on: { eq: '1990-01-01' } },
    });
    expect(parameters.dqb_0).toBe('1990-01-01');
  });

  it('nunca interpola valor no SQL', () => {
    const { sql } = compileToQueryBuilder({
      filter: { name: { eq: "x' OR 1=1--" } },
    });
    expect(sql).not.toContain('OR 1=1');
    expect(sql).toMatch(/:dqb_0/);
  });

  it('a query de count não carrega joins de apresentação', () => {
    const { countSql } = compileToQueryBuilder(
      { includes: 'company,posts', filter: { 'company.name': { eq: 'Acme' } } },
      'user.deep'
    );
    expect(countSql.match(/LEFT JOIN/gi)).toHaveLength(1);
  });
});
