import { closeSqlite, compileToQueryBuilder, openSqlite } from './helpers';

beforeAll(async () => {
  await openSqlite();
});
afterAll(closeSqlite);

describe('projeção TypeORM', () => {
  it('projeta cada alias explicitamente', () => {
    const { sql } = compileToQueryBuilder({ fields: 'id,name' });
    expect(sql).toMatch(/SELECT "root"\."id".*"root"\."name".* FROM/s);
  });

  it('fields + includes mantém as colunas da relação', () => {
    const { sql } = compileToQueryBuilder({
      fields: 'id,name,company.name',
      includes: 'company',
    });
    expect(sql).toMatch(/"root_company"\."name"/);
  });

  it('include sem fields dotted usa os defaults da relação', () => {
    const { sql } = compileToQueryBuilder({ includes: 'company' });
    expect(sql).toMatch(/"root_company"\."id"/);
    expect(sql).toMatch(/"root_company"\."name"/);
  });

  it('seleciona a PK internamente mesmo fora da projeção visível', () => {
    const { sql } = compileToQueryBuilder({ fields: 'name' });
    expect(sql).toMatch(/"root"\."id"/);
  });

  it('usa a PK real, não id hard-coded', () => {
    const { sql } = compileToQueryBuilder({ fields: 'label' }, 'tag.default');
    expect(sql).toMatch(/"root"\."post_id"/);
    expect(sql).toMatch(/"root"\."label"/);
    expect(sql).not.toMatch(/"root"\."id"/);
  });

  it('seleciona a PK de cada relação incluída para hidratação', () => {
    const { sql } = compileToQueryBuilder({
      fields: 'id,company.name',
      includes: 'company',
    });
    expect(sql).toMatch(/"root_company"\."id"/);
  });

  it('nunca projeta colunas internas folded ou portableOrder', () => {
    const { sql } = compileToQueryBuilder({ includes: 'company' });
    expect(sql).not.toMatch(/SELECT[^]*name_folded[^]*FROM/);
  });

  it('join de predicado sem include não entra na projeção', () => {
    const { sql } = compileToQueryBuilder({
      filter: { 'company.name': { eq: 'Acme' } },
    });
    const select = sql.slice(0, sql.indexOf(' FROM '));
    expect(sql).toMatch(/LEFT JOIN/i);
    expect(select).not.toMatch(/root_company/);
  });

  it('projeta relações profundas em aliases distintos', () => {
    const { sql } = compileToQueryBuilder(
      { includes: 'company,company.owner' },
      'user.deep'
    );
    const select = sql.slice(0, sql.indexOf(' FROM '));
    expect(select).toMatch(/"root_company"\."name"/);
    expect(select).toMatch(/"root_company_owner"\."name"/);
  });

  it('projeta a relação many junto com sua PK', () => {
    const { sql } = compileToQueryBuilder({ includes: 'posts' }, 'user.deep');
    const select = sql.slice(0, sql.indexOf(' FROM '));
    expect(select).toMatch(/"root_posts"\."id"/);
    expect(select).toMatch(/"root_posts"\."title"/);
  });
});
