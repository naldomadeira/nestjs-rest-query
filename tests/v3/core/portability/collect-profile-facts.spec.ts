import {
  assertProfileFacts,
  collectProfileFacts,
  type ProfileColumnRef,
  type ProfileDialect,
} from '@core/portability';

/**
 * O coletor é o que faz `PORTABILITY_PROFILE_MISMATCH` significar algo.
 *
 * `checkPortabilityProfile` é pura e recebe fatos prontos: sem coletor, ela
 * valida o que o chamador *disse* sobre o banco, e fatos inventados passam.
 * Estes casos provam que cada dialeto lê o catálogo certo e traduz o resultado
 * para a mesma forma, porque é essa forma que o gate compara.
 */
const TEXT_COLUMNS: readonly ProfileColumnRef[] = [
  ['users', 'name'],
  ['companies', 'name'],
];
const REQUIRED_INDEXES = ['users_name_folded_idx'];

/** Executor de SQL cru falso: responde na ordem em que o coletor pergunta. */
function runnerReturning(...batches: readonly (readonly unknown[])[]) {
  const seen: string[] = [];
  const seenParams: (readonly unknown[] | undefined)[] = [];
  let call = 0;
  const query = async <R>(
    sql: string,
    params?: readonly unknown[]
  ): Promise<readonly R[]> => {
    seen.push(sql);
    seenParams.push(params);
    return (batches[call++] ?? []) as readonly R[];
  };
  return { query, seen, seenParams };
}

/**
 * Resposta da sonda de fuso do cliente, que é a **primeira** query de todo
 * coletor. `UTC` faz a sonda passar; qualquer outro texto simula um driver
 * convertendo para fuso local.
 */
const probeAnswer = (echoed = '2000-01-01T12:00:00') => [{ echoed }];

const collect = (
  dialect: ProfileDialect,
  ...batches: readonly (readonly unknown[])[]
) =>
  collectProfileFacts({
    dialect,
    query: runnerReturning(probeAnswer(), ...batches).query,
    textColumns: TEXT_COLUMNS,
    requiredIndexes: REQUIRED_INDEXES,
  });

describe('collectProfileFacts', () => {
  it('lê encoding, timezone e collation do catálogo do Postgres', async () => {
    const facts = await collect(
      'postgres',
      [{ encoding: 'UTF8', timezone: 'UTC', version: '18.0' }],
      [
        { table_name: 'users', column_name: 'name', collation_name: 'C' },
        {
          table_name: 'companies',
          column_name: 'name',
          collation_name: 'C',
        },
      ],
      [{ indexname: 'users_name_folded_idx' }]
    );

    expect(facts).toEqual({
      dialect: 'postgres',
      serverVersion: '18.0',
      encoding: 'UTF8',
      sessionTimeZone: 'UTC',
      clientDateTimeIsUtc: true,
      strictMode: true,
      textColumns: [
        { table: 'users', column: 'name', collation: 'C' },
        { table: 'companies', column: 'name', collation: 'C' },
      ],
      indexes: ['users_name_folded_idx'],
      requiredIndexes: REQUIRED_INDEXES,
    });
  });

  it('deriva o modo estrito do sql_mode da sessão no MySQL', async () => {
    const strict = await collect(
      'mysql',
      [
        {
          charset: 'utf8mb4',
          timezone: '+00:00',
          version: '8.4.0',
          sqlMode: 'STRICT_ALL_TABLES,NO_ZERO_DATE',
        },
      ],
      [],
      []
    );

    // `+00:00` é como o MySQL relata UTC; o gate compara com 'UTC'.
    expect(strict.sessionTimeZone).toBe('UTC');
    expect(strict.strictMode).toBe(true);

    const loose = await collect(
      'mysql',
      [
        {
          charset: 'utf8mb4',
          timezone: 'America/Sao_Paulo',
          version: '8.4.0',
          sqlMode: 'ONLY_FULL_GROUP_BY',
        },
      ],
      [],
      []
    );

    expect(loose.sessionTimeZone).toBe('America/Sao_Paulo');
    expect(loose.strictMode).toBe(false);
  });

  it('usa a collation do banco como fallback no SQL Server', async () => {
    const facts = await collect(
      'mssql',
      [{ collation: 'Latin1_General_100_BIN2_UTF8', version: '16.0.4200' }],
      [
        {
          table_name: 'users',
          column_name: 'name',
          collation_name: 'Latin1_General_100_BIN2_UTF8',
        },
      ],
      [{ name: 'users_name_folded_idx' }]
    );

    expect(facts.encoding).toBe('UTF8');
    expect(facts.sessionTimeZone).toBe('UTC');
    // `companies.name` não voltou do catálogo: cai na collation do banco.
    expect(facts.textColumns).toEqual([
      {
        table: 'users',
        column: 'name',
        collation: 'Latin1_General_100_BIN2_UTF8',
      },
      {
        table: 'companies',
        column: 'name',
        collation: 'Latin1_General_100_BIN2_UTF8',
      },
    ]);
  });

  /**
   * `SYSTEM` não é um timezone: é "pergunte ao sistema operacional".
   *
   * Deixá-lo passar cru faria o gate reprovar o perfil exibindo um literal
   * opaco, sem dizer qual timezone o banco está usando de fato.
   */
  it('resolve o timezone SYSTEM do MySQL pelo @@system_time_zone', async () => {
    const facts = await collect(
      'mysql',
      [
        {
          charset: 'utf8mb4',
          timezone: 'SYSTEM',
          systemTimezone: 'UTC',
          version: '8.4.0',
          sqlMode: 'STRICT_TRANS_TABLES',
        },
      ],
      [],
      []
    );

    expect(facts.sessionTimeZone).toBe('UTC');
  });

  it('lê a collation por coluna do information_schema do MySQL', async () => {
    const facts = await collect(
      'mysql',
      [
        {
          charset: 'utf8mb4',
          timezone: '+00:00',
          systemTimezone: 'UTC',
          version: '8.4.0',
          sqlMode: 'STRICT_ALL_TABLES',
        },
      ],
      // O MySQL devolve as colunas do catálogo em maiúsculas.
      [
        {
          TABLE_NAME: 'users',
          COLUMN_NAME: 'name',
          COLLATION_NAME: 'utf8mb4_bin',
        },
      ],
      [{ INDEX_NAME: 'users_name_folded_idx' }]
    );

    // `companies.name` não voltou do catálogo: cai no fallback do dialeto.
    expect(facts.textColumns).toEqual([
      { table: 'users', column: 'name', collation: 'utf8mb4_bin' },
      { table: 'companies', column: 'name', collation: 'unknown' },
    ]);
    expect(facts.indexes).toEqual(['users_name_folded_idx']);
  });

  /**
   * Catálogo vazio é perfil não verificado, e a diferença importa: sem isto o
   * acesso a `server.version` estouraria um `TypeError` cru, e o chamador veria
   * erro de programação onde deveria ver `PORTABILITY_PROFILE_MISMATCH`.
   */
  it.each(['postgres', 'mysql', 'mssql'] as const)(
    'acusa perfil não verificável quando o catálogo do %s não responde',
    async (dialect) => {
      await expect(collect(dialect, [])).rejects.toMatchObject({
        code: 'PORTABILITY_PROFILE_MISMATCH',
      });
    }
  );

  /**
   * Escopo das queries do SQL Server (spec §6.3).
   *
   * `INFORMATION_SCHEMA.COLUMNS` e `sys.indexes` sem filtro trazem os objetos
   * de sistema, e aí `facts.indexes` deixa de ser comparável com o que Postgres
   * e MySQL coletam no escopo do schema corrente.
   */
  it('restringe as queries do SQL Server ao schema e às tabelas de usuário', async () => {
    const runner = runnerReturning(
      probeAnswer(),
      [{ collation: 'Latin1_General_100_BIN2_UTF8', version: '16.0.4200' }],
      [],
      []
    );

    await collectProfileFacts({
      dialect: 'mssql',
      query: runner.query,
      textColumns: TEXT_COLUMNS,
      requiredIndexes: REQUIRED_INDEXES,
    });

    // Casar por conteúdo, não por índice: a ordem das queries do coletor é
    // detalhe interno, e ancorar nela fez este teste quebrar quando a sonda de
    // fuso entrou na frente.
    const columns = runner.seen.find((sql) =>
      sql.includes('INFORMATION_SCHEMA')
    );
    const indexes = runner.seen.find((sql) => sql.includes('sys.indexes'));

    expect(columns).toContain('TABLE_SCHEMA = SCHEMA_NAME()');
    expect(indexes).toContain('t.is_ms_shipped = 0');
  });

  it('recusa um dialeto sem coletor em vez de devolver fatos vazios', async () => {
    await expect(
      collectProfileFacts({
        dialect: 'oracle' as unknown as ProfileDialect,
        query: runnerReturning().query,
        textColumns: TEXT_COLUMNS,
        requiredIndexes: REQUIRED_INDEXES,
      })
    ).rejects.toMatchObject({ code: 'PORTABILITY_PROFILE_MISMATCH' });
  });
});

describe('sonda de fuso do cliente', () => {
  it('reconhece um driver que entrega o instante em UTC', async () => {
    const facts = await collect(
      'postgres',
      [{ encoding: 'UTF8', timezone: 'UTC', version: '18.0' }],
      [],
      []
    );

    expect(facts.clientDateTimeIsUtc).toBe(true);
  });

  it('acusa um driver que desloca para o fuso local', async () => {
    // O que o TypeORM faz no SQL Server com `useUTC: false`: manda a hora de
    // parede local. UTC-3 transforma 12:00:00Z em 09:00:00.
    const query = runnerReturning(
      probeAnswer('2000-01-01T09:00:00'),
      [{ collation: 'Latin1_General_100_BIN2_UTF8', version: '16.0' }],
      [],
      []
    ).query;

    const facts = await collectProfileFacts({
      dialect: 'mssql',
      query,
      textColumns: TEXT_COLUMNS,
      requiredIndexes: REQUIRED_INDEXES,
    });

    expect(facts.clientDateTimeIsUtc).toBe(false);
  });

  it('aceita o eco com espaço em vez de T, que alguns drivers devolvem', async () => {
    // `DATE_FORMAT` do MySQL e `CONVERT` do SQL Server podem devolver o
    // separador como espaço; o instante é o mesmo e não é violação.
    const query = runnerReturning(
      probeAnswer('2000-01-01 12:00:00'),
      [
        {
          charset: 'utf8mb4',
          timezone: '+00:00',
          version: '8.4.0',
          sqlMode: 'STRICT_ALL_TABLES',
        },
      ],
      [],
      []
    ).query;

    const facts = await collectProfileFacts({
      dialect: 'mysql',
      query,
      textColumns: TEXT_COLUMNS,
      requiredIndexes: REQUIRED_INDEXES,
    });

    expect(facts.clientDateTimeIsUtc).toBe(true);
  });

  it('reconhece UTC no MySQL pelo caminho normal', async () => {
    const facts = await collect(
      'mysql',
      [
        {
          charset: 'utf8mb4',
          timezone: '+00:00',
          version: '8.4.0',
          sqlMode: 'STRICT_ALL_TABLES',
        },
      ],
      [],
      []
    );

    expect(facts.clientDateTimeIsUtc).toBe(true);
  });

  it('manda o instante como parâmetro vinculado, não interpolado no SQL', async () => {
    // Trava o contrato de dois argumentos do `ProfileQueryRunner`. Se o
    // repasse de parâmetros se perder, a sonda deixa de medir a conversão do
    // driver — que é a única coisa que ela existe para medir — e passa a
    // reprovar tudo. Já aconteceu uma vez, num `git checkout` distraído.
    const runner = runnerReturning(
      probeAnswer(),
      [{ encoding: 'UTF8', timezone: 'UTC', version: '18.0' }],
      [],
      []
    );

    await collectProfileFacts({
      dialect: 'postgres',
      query: runner.query,
      textColumns: TEXT_COLUMNS,
      requiredIndexes: REQUIRED_INDEXES,
    });

    const [probeParams] = runner.seenParams;
    expect(probeParams).toHaveLength(1);
    expect(probeParams?.[0]).toBeInstanceOf(Date);
    expect((probeParams?.[0] as Date).toISOString()).toBe(
      '2000-01-01T12:00:00.000Z'
    );

    // E o instante não aparece no texto da query: interpolar mediria a nossa
    // formatação em vez da conversão do driver.
    expect(runner.seen[0]).not.toContain('2000-01-01');
  });

  it('falha fechado quando o executor ignora parâmetros vinculados', async () => {
    // "Não sei" não é "está certo" (§5.6): um executor que não vincula
    // parâmetro nenhum não consegue provar nada sobre o fuso do driver.
    const query = async <R>(): Promise<readonly R[]> => {
      throw new Error('bind parameters are not supported');
    };

    await expect(
      collectProfileFacts({
        dialect: 'postgres',
        query,
        textColumns: TEXT_COLUMNS,
        requiredIndexes: REQUIRED_INDEXES,
      })
    ).rejects.toMatchObject({ code: 'PORTABILITY_PROFILE_MISMATCH' });
  });

  it('falha fechado quando a sonda não devolve valor', async () => {
    await expect(
      collectProfileFacts({
        dialect: 'postgres',
        query: runnerReturning([]).query,
        textColumns: TEXT_COLUMNS,
        requiredIndexes: REQUIRED_INDEXES,
      })
    ).rejects.toMatchObject({ code: 'PORTABILITY_PROFILE_MISMATCH' });
  });
});

describe('assertProfileFacts', () => {
  const postgresBatches = (collation: string, indexes: string[]) =>
    [
      probeAnswer(),
      [{ encoding: 'UTF8', timezone: 'UTC', version: '18.0' }],
      [
        { table_name: 'users', column_name: 'name', collation_name: collation },
        {
          table_name: 'companies',
          column_name: 'name',
          collation_name: collation,
        },
      ],
      indexes.map((indexname) => ({ indexname })),
    ] as const;

  it('devolve os fatos quando o banco está no perfil', async () => {
    const facts = await assertProfileFacts({
      dialect: 'postgres',
      query: runnerReturning(...postgresBatches('C', REQUIRED_INDEXES)).query,
      textColumns: TEXT_COLUMNS,
      requiredIndexes: REQUIRED_INDEXES,
    });

    expect(facts.dialect).toBe('postgres');
  });

  it('falha com o código canônico, não com um Error genérico', async () => {
    // Um índice exigido pelo perfil que não existe no banco.
    const promise = assertProfileFacts({
      dialect: 'postgres',
      query: runnerReturning(...postgresBatches('C', [])).query,
      textColumns: TEXT_COLUMNS,
      requiredIndexes: REQUIRED_INDEXES,
    });

    await expect(promise).rejects.toMatchObject({
      code: 'PORTABILITY_PROFILE_MISMATCH',
    });
  });

  it('acusa collation fora do perfil certificado', async () => {
    const promise = assertProfileFacts({
      dialect: 'postgres',
      query: runnerReturning(...postgresBatches('pt_BR.utf8', REQUIRED_INDEXES))
        .query,
      textColumns: TEXT_COLUMNS,
      requiredIndexes: REQUIRED_INDEXES,
    });

    await expect(promise).rejects.toMatchObject({
      code: 'PORTABILITY_PROFILE_MISMATCH',
    });
  });
});
