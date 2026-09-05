import type { CompiledQueryRules } from '@core/authorization';
import { buildQueryPlan } from '@core/query-plan';
import { normalizeResult } from '@core/result-normalizer';
import { compilePlan, executeCompiled } from '@infra/adapters/typeorm';
import { ESCAPE_CHARACTER } from './helpers';
import {
  articleRules,
  closeLocalSqlite,
  labelRules,
  ledgerRules,
  localRepository,
  openLocalSqlite,
  seedLocalArticles,
} from './local-schemas';

beforeAll(async () => {
  await openLocalSqlite();
  await seedLocalArticles();
}, 60_000);
afterAll(closeLocalSqlite);

type LocalEntity = 'ledger' | 'article' | 'label';

interface Snapshot {
  /** SQL sem as aspas de identificador, para a asserção não depender delas. */
  sql: string;
  /** SQL como o driver o recebe, para quando a citação *é* o objeto do teste. */
  quotedSql: string;
  parameters: Record<string, unknown>;
}

/** Compila contra o fixture local e devolve só o SQL, sem tocar no banco. */
function compileOn(
  entity: LocalEntity,
  rules: CompiledQueryRules,
  query: Record<string, unknown>
): Snapshot {
  const plan = buildQueryPlan(query, rules);
  const compiled = compilePlan(plan, localRepository(entity), ESCAPE_CHARACTER);
  const sql = compiled.data.getQuery();

  return {
    sql: sql.replace(/"/g, ''),
    quotedSql: sql,
    parameters: compiled.data.getParameters(),
  };
}

const compileLedger = (query: Record<string, unknown>): Snapshot =>
  compileOn('ledger', ledgerRules(), query);

/** Roda de verdade contra o SQLite local e reduz ao que é observável. */
async function runOn(
  entity: LocalEntity,
  rules: CompiledQueryRules,
  query: Record<string, unknown>
): Promise<{ ids: unknown[]; total?: number }> {
  const plan = buildQueryPlan(query, rules);
  const compiled = compilePlan(plan, localRepository(entity), ESCAPE_CHARACTER);
  const result = await executeCompiled(compiled);
  const normalized = normalizeResult<Record<string, unknown>>(
    result.rows,
    result.total,
    plan
  );

  return { ids: normalized.data.map((row) => row.id), total: normalized.total };
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

describe('cadeia existencial de mais de um salto', () => {
  it('correlaciona o root uma vez e junta o segundo salto dentro do EXISTS', () => {
    // A forma-alvo, igual à do Drizzle: um único EXISTS correlacionado com o
    // root, e o salto seguinte como INNER JOIN *dentro* da subconsulta.
    // Correlacionar o segundo salto por fora traria a coleção para o FROM
    // externo, inflaria os roots e estragaria o `total` — que é exatamente o
    // que o EXISTS existe para evitar.
    //
    // Aqui a FK composta aparece nos dois lugares: nas duas colunas da
    // correlação e nas duas do ON do join. Nenhum outro fixture do repo junta
    // as duas coisas.
    const { sql } = compileLedger({
      filter: { 'entries.ledger.title': { eq: 'primeiro' } },
    });

    expect(sql).toContain(
      'EXISTS (SELECT 1 FROM entries dqb_ex_entries ' +
        'INNER JOIN ledgers dqb_ex_entries_ledger ' +
        'ON dqb_ex_entries_ledger.tenant_id = dqb_ex_entries.ledger_tenant_id ' +
        'AND dqb_ex_entries_ledger.code = dqb_ex_entries.ledger_code ' +
        'WHERE dqb_ex_entries.ledger_tenant_id = root.tenant_id ' +
        'AND dqb_ex_entries.ledger_code = root.code ' +
        'AND dqb_ex_entries_ledger.title = :dqb_0)'
    );
    // Um EXISTS, não dois aninhados nem dois no AND.
    expect(sql.match(/EXISTS/g)).toHaveLength(1);
    // E nenhum join fora da subconsulta: o root continua uma linha por root.
    expect(sql.slice(0, sql.indexOf('EXISTS'))).not.toMatch(/JOIN/i);
  });

  it('a folha é qualificada pelo último alias da cadeia, não pelo primeiro', () => {
    // Qualificar pelo primeiro alias produziria `dqb_ex_entries.title`. Aqui
    // isso morreria no driver, mas numa cadeia em que as duas pontas têm uma
    // coluna de mesmo nome o SQL seria válido e o resultado, errado em
    // silêncio — que é a falha que este teste tranca.
    const { sql } = compileLedger({
      filter: { 'entries.ledger.title': { eq: 'primeiro' } },
    });
    expect(sql).toContain('dqb_ex_entries_ledger.title = :dqb_0');
    expect(sql).not.toContain('dqb_ex_entries.title');
  });
});

describe('many-to-many atravessa a tabela de junção', () => {
  const compileArticle = (query: Record<string, unknown>): Snapshot =>
    compileOn('article', articleRules(), query);
  const compileLabel = (query: Record<string, unknown>): Snapshot =>
    compileOn('label', labelRules(), query);

  it('do lado dono, a junção entra no FROM e o alvo vem por join', () => {
    // O guard que existia aqui recusava a m2m porque o código anterior emitia
    // `EXISTS (SELECT 1 FROM articles ... WHERE articles.articlesId =
    // root.id)`: numa m2m o lado dono *tem* join columns, mas são as da
    // junção, enquanto `entityMetadata` continua sendo a entidade que declara
    // a relação. SQL válido, tabela errada, resultado errado e silencioso.
    const { sql } = compileArticle({
      filter: { 'labels.name': { eq: 'oss' } },
    });

    expect(sql).toContain(
      'EXISTS (SELECT 1 FROM articles_labels_labels dqb_ex_labels_j ' +
        'INNER JOIN labels dqb_ex_labels ' +
        'ON dqb_ex_labels.id = dqb_ex_labels_j.labelsId ' +
        'WHERE dqb_ex_labels_j.articlesId = root.id ' +
        'AND dqb_ex_labels.name = :dqb_0)'
    );
    // A junção não é pulada: nem o alvo entra direto no FROM, nem o root é
    // correlacionado com a tabela da própria relação.
    expect(sql).not.toMatch(/EXISTS \(SELECT 1 FROM labels/);
    expect(sql).not.toMatch(/EXISTS \(SELECT 1 FROM articles dqb/);
  });

  it('do lado inverso, os dois conjuntos de colunas trocam de papel', () => {
    // Só o lado dono guarda `junctionEntityMetadata` e as join columns; do
    // lado inverso elas vêm do dono, e o que aponta para o alvo lá é o que
    // aponta para o pai aqui. Sem um root deste lado, a travessia ficaria
    // provada numa direção só.
    const { sql } = compileLabel({
      filter: { 'articles.title': { eq: 'Alpha' } },
    });

    expect(sql).toContain(
      'EXISTS (SELECT 1 FROM articles_labels_labels dqb_ex_articles_j ' +
        'INNER JOIN articles dqb_ex_articles ' +
        'ON dqb_ex_articles.id = dqb_ex_articles_j.articlesId ' +
        'WHERE dqb_ex_articles_j.labelsId = root.id ' +
        'AND dqb_ex_articles.title = :dqb_0)'
    );
  });

  it('cita os identificadores da junção, que o TypeORM gera em camelCase', () => {
    // `articlesId` e `labelsId` são nomes que a estratégia de nomes do TypeORM
    // inventa, não do consumidor. Sem aspas, o PostgreSQL os dobra para
    // minúsculas e não acha a coluna — a m2m compilaria e morreria no driver.
    const { quotedSql } = compileArticle({
      filter: { 'labels.name': { eq: 'oss' } },
    });

    expect(quotedSql).toContain('"articles_labels_labels" dqb_ex_labels_j');
    expect(quotedSql).toContain('dqb_ex_labels_j."articlesId"');
    expect(quotedSql).toContain('dqb_ex_labels_j."labelsId"');
  });

  it('a busca atravessa a mesma junção, contra a coluna dobrada', () => {
    // Filtro e busca compartilham a maquinaria: se a busca tivesse caminho
    // próprio, teria de reaprender a junção — e foi por não sair por aqui que
    // o alvo `many` virava join de predicado e encurtava a página.
    const { sql, parameters } = compileArticle({ search: 'OSS' });

    expect(sql).toContain(
      'EXISTS (SELECT 1 FROM articles_labels_labels dqb_ex_labels_j ' +
        'INNER JOIN labels dqb_ex_labels ' +
        'ON dqb_ex_labels.id = dqb_ex_labels_j.labelsId ' +
        'WHERE dqb_ex_labels_j.articlesId = root.id ' +
        `AND dqb_ex_labels.name_folded LIKE :dqb_0 ESCAPE '${ESCAPE_CHARACTER}')`
    );
    expect(parameters.dqb_0).toBe('%oss%');
  });

  it('devolve os roots ligados pela junção, e só eles', async () => {
    // A prova de que a junção é atravessada e não pulada não pode ser só de
    // texto: o artigo 3 não tem rótulo nenhum e não pode aparecer.
    const { ids, total } = await runOn('article', articleRules(), {
      filter: { 'labels.name': { eq: 'oss' } },
    });

    expect(ids).toEqual([1, 2]);
    expect(total).toBe(2);
  });

  it('um root ligado a dois rótulos ainda conta uma vez', async () => {
    // `oss` e `oss-core` casam os dois; o artigo 1 está ligado aos dois pela
    // junção. Com join no lugar do EXISTS, ele voltaria duplicado e o `total`
    // seria 3 — página inflada com contagem inflada junto.
    const { ids, total } = await runOn('article', articleRules(), {
      search: 'oss',
    });

    expect(ids).toEqual([1, 2]);
    expect(total).toBe(2);
  });

  it('do lado inverso, devolve os rótulos do artigo pedido', async () => {
    const { ids, total } = await runOn('label', labelRules(), {
      filter: { 'articles.title': { eq: 'Alpha' } },
    });

    expect(ids).toEqual([1, 2]);
    expect(total).toBe(2);
  });
});
