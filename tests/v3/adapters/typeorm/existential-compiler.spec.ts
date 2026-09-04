import { buildQueryPlan } from '@core/query-plan';
import { compilePlan } from '@infra/adapters/typeorm';
import { ESCAPE_CHARACTER } from './helpers';
import {
  articleRules,
  closeLocalSqlite,
  ledgerRules,
  localRepository,
  openLocalSqlite,
} from './local-schemas';

beforeAll(async () => {
  await openLocalSqlite();
});
afterAll(closeLocalSqlite);

interface Snapshot {
  /** SQL sem as aspas de identificador, para a asserção não depender delas. */
  sql: string;
  parameters: Record<string, unknown>;
}

/** Compila contra o fixture local e devolve só o SQL, sem tocar no banco. */
function compileLedger(query: Record<string, unknown>): Snapshot {
  const plan = buildQueryPlan(query, ledgerRules());
  const compiled = compilePlan(
    plan,
    localRepository('ledger'),
    ESCAPE_CHARACTER
  );
  return {
    sql: compiled.data.getQuery().replace(/"/g, ''),
    parameters: compiled.data.getParameters(),
  };
}

const EXISTS_PREFIX = 'EXISTS (SELECT 1 FROM entries dqb_ex_entries WHERE';

describe('filtro existencial: correlação por PK composta', () => {
  it('correlaciona todas as partes da FK, não só a primeira', () => {
    // Com PK composta, correlacionar por uma coluna só faria o EXISTS casar
    // entries de outro tenant: o filtro passaria a devolver roots errados, e o
    // erro seria silencioso porque o SQL continua válido.
    const { sql } = compileLedger({
      filter: { 'entries.amount': { eq: '10' } },
    });

    expect(sql).toContain(
      `${EXISTS_PREFIX} dqb_ex_entries.ledger_tenant_id = root.tenant_id AND dqb_ex_entries.ledger_code = root.code AND dqb_ex_entries.amount = :dqb_0)`
    );
  });

  it('a subquery substitui o join, então o root nunca infla', () => {
    const { sql } = compileLedger({
      filter: { 'entries.amount': { eq: '10' } },
    });
    expect(sql).not.toMatch(/LEFT JOIN/i);
  });
});

describe('operadores dentro do EXISTS', () => {
  it('isNull=true testa a nulidade da coluna da folha, não a coleção vazia', () => {
    // A distinção importa: "alguma entry sem nota" (aqui) não é "nenhuma
    // entry" — este segundo caso é o filtro pela própria relação, abaixo.
    const { sql } = compileLedger({
      filter: { 'entries.note': { isNull: 'true' } },
    });
    expect(sql).toContain(`AND dqb_ex_entries.note IS NULL)`);
    expect(sql).not.toMatch(/NOT EXISTS/i);
  });

  it('isNull=false nega a nulidade da folha e não a existência', () => {
    const { sql } = compileLedger({
      filter: { 'entries.note': { isNull: 'false' } },
    });
    expect(sql).toContain(`AND dqb_ex_entries.note IS NOT NULL)`);
    expect(sql).not.toMatch(/NOT EXISTS/i);
  });

  it('isNull=true na própria relação vira NOT EXISTS', () => {
    const { sql } = compileLedger({ filter: { entries: { isNull: 'true' } } });
    expect(sql).toContain(`NOT ${EXISTS_PREFIX}`);
    // Sem folha: a condição é só a correlação.
    expect(sql).toContain('dqb_ex_entries.ledger_code = root.code)');
  });

  it('in usa expansão de lista dentro da subquery', () => {
    const { sql, parameters } = compileLedger({
      filter: { 'entries.amount': { in: '10,20' } },
    });
    expect(sql).toContain('dqb_ex_entries.amount IN (:...dqb_0)');
    expect(parameters.dqb_0).toEqual([10, 20]);
  });

  it('notIn nega dentro da subquery, e não a subquery inteira', () => {
    // `NOT EXISTS (... amount IN ...)` significaria "nenhuma entry com esses
    // valores"; o contrato é "alguma entry com valor fora da lista".
    const { sql } = compileLedger({
      filter: { 'entries.amount': { notIn: '10,20' } },
    });
    expect(sql).toContain('dqb_ex_entries.amount NOT IN (:...dqb_0)');
    expect(sql).not.toMatch(/NOT EXISTS/i);
  });

  it('between emite dois parâmetros próprios', () => {
    const { sql, parameters } = compileLedger({
      filter: { 'entries.amount': { between: '10,20' } },
    });
    expect(sql).toContain('dqb_ex_entries.amount BETWEEN :dqb_0 AND :dqb_1');
    expect(parameters).toEqual({ dqb_0: 10, dqb_1: 20 });
  });

  it('like escapa o padrão e emite a cláusula ESCAPE também dentro do EXISTS', () => {
    const { sql, parameters } = compileLedger({
      filter: { 'entries.label': { like: '50%' } },
    });
    expect(sql).toContain(
      `dqb_ex_entries.label LIKE :dqb_0 ESCAPE '${ESCAPE_CHARACTER}'`
    );
    expect(parameters.dqb_0).toBe('%50!%%');
  });

  it('notLike nega o LIKE da folha', () => {
    const { sql } = compileLedger({
      filter: { 'entries.label': { notLike: 'beta' } },
    });
    expect(sql).toContain(
      `dqb_ex_entries.label NOT LIKE :dqb_0 ESCAPE '${ESCAPE_CHARACTER}'`
    );
  });

  it('ilike consulta a coluna dobrada da folha, não a original', () => {
    const { sql, parameters } = compileLedger({
      filter: { 'entries.label': { ilike: 'AÇÃO' } },
    });
    expect(sql).toContain(
      `dqb_ex_entries.label_folded LIKE :dqb_0 ESCAPE '${ESCAPE_CHARACTER}'`
    );
    expect(sql).not.toMatch(/ILIKE/i);
    expect(parameters.dqb_0).toBe('%ação%');
  });

  it('notIlike nega o LIKE sobre a coluna dobrada', () => {
    const { sql, parameters } = compileLedger({
      filter: { 'entries.label': { notIlike: 'AÇÃO' } },
    });
    expect(sql).toContain(
      `dqb_ex_entries.label_folded NOT LIKE :dqb_0 ESCAPE '${ESCAPE_CHARACTER}'`
    );
    expect(parameters.dqb_0).toBe('%ação%');
  });

  it('nenhum valor é interpolado no SQL da subquery', () => {
    const { sql } = compileLedger({
      filter: { 'entries.label': { like: "x' OR 1=1--" } },
    });
    expect(sql).not.toContain('OR 1=1');
  });
});

describe('search através de relação many', () => {
  it('correlaciona a busca pela FK composta inteira, como o filtro', () => {
    // A busca por uma folha `many` é a mesma pergunta do filtro existencial
    // ("algum item corresponde"), então tem de sair pela mesma maquinaria: um
    // caminho próprio para o search teria de reaprender a FK composta, e foi
    // justamente por não sair por aqui que ela virava join de predicado.
    const { sql, parameters } = compileLedger({ search: 'AÇÃO' });

    expect(sql).toContain(
      `${EXISTS_PREFIX} dqb_ex_entries.ledger_tenant_id = root.tenant_id AND dqb_ex_entries.ledger_code = root.code AND dqb_ex_entries.label_folded LIKE :dqb_0 ESCAPE '${ESCAPE_CHARACTER}')`
    );
    // Termo dobrado contra a coluna dobrada: nenhum ILIKE, nenhuma collation.
    expect(parameters.dqb_0).toBe('%ação%');
    expect(sql).not.toMatch(/JOIN/i);
  });
});

describe('cardinalidades que o adapter recusa', () => {
  it('many-to-many é recusada explicitamente, não compilada errado', () => {
    // O TypeORM guarda as join columns de uma many-to-many na tabela de
    // junção, mas `entityMetadata` continua sendo a entidade que declara a
    // relação: correlacionar com esse par gerava `EXISTS (SELECT 1 FROM
    // articles ... WHERE articles.articlesId = root.id)` — SQL válido, tabela
    // errada, resultado errado e silencioso.
    const plan = buildQueryPlan(
      { filter: { 'labels.name': { eq: 'oss' } } },
      articleRules()
    );

    expect(() =>
      compilePlan(plan, localRepository('article'), ESCAPE_CHARACTER)
    ).toThrow(
      expect.objectContaining({
        code: 'CAPABILITY_UNAVAILABLE',
        message: expect.stringContaining('many-to-many'),
      })
    );
  });
});
