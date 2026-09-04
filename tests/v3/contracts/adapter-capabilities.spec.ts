import type { AdapterCapabilities, SqlDialect } from '@contracts/v3';
import { DrizzleAdapter } from '@infra/adapters/drizzle';
import { PrismaAdapter } from '@infra/adapters/prisma';

/**
 * Invariantes que valem para **todo** adapter, não para um.
 *
 * `AdapterCapabilities` existe para o núcleo decidir sem perguntar ao ORM, e
 * por isso uma capability que não descreve o comportamento real é pior que
 * capability nenhuma: foi assim que o adapter Prisma declarou
 * `escapeCharacter: '!'` sem nunca emitir cláusula `ESCAPE`, entregando coringa
 * onde a §11 promete literal.
 *
 * Cada adapter já testa as suas capabilities no seu próprio arquivo. O que só
 * pode ser verificado aqui é a regra que atravessa os adapters — e é aqui que
 * ela continua valendo se um deles passar a decidir por dialeto amanhã.
 *
 * O TypeORM fica fora da tabela porque as capabilities dele derivam do driver
 * de um `DataSource` real; ele emite `ESCAPE` explicitamente em todo dialeto e
 * é coberto por `tests/v3/adapters/typeorm/adapter.spec.ts`.
 */
describe('invariantes de AdapterCapabilities', () => {
  /**
   * Um caso por adapter, com todos os dialetos que ele sabe declarar.
   *
   * Não usa as sources reais de propósito: a invariante é sobre a *forma* das
   * capabilities, e montar DataSource, client gerado e executor só para ler
   * dois campos acoplaria este arquivo a três harnesses diferentes.
   */
  const CAPABILITIES: readonly (readonly [string, AdapterCapabilities])[] = [
    ...(['postgresql', 'mysql', 'sqlserver', 'sqlite'] as const).map(
      (provider) =>
        [
          `prisma/${provider}`,
          new PrismaAdapter().capabilities({
            model: 'user',
            manifest: {
              provider,
              registry: new Map(),
              models: {},
            },
          } as never),
        ] as const
    ),
    ...(['postgres', 'mysql', 'mssql', 'sqlite'] as const).map(
      (dialect) =>
        [
          `drizzle/${dialect}`,
          new DrizzleAdapter().capabilities({ dialect } as never),
        ] as const
    ),
  ];

  it.each(CAPABILITIES)(
    '%s: escapeCharacter é vazio exatamente quando não há escape possível',
    (_id, capabilities) => {
      expect(capabilities.patternEscape === 'unsupported').toBe(
        capabilities.escapeCharacter === ''
      );
    }
  );

  it.each(CAPABILITIES)(
    '%s: declara um patternEscape do contrato',
    (_id, capabilities) => {
      expect(['clause', 'native', 'unsupported']).toContain(
        capabilities.patternEscape
      );
    }
  );

  /**
   * Exaustividade por tipo, não por vigilância.
   *
   * A tabela acima é escrita à mão, então um dialeto novo no contrato não
   * apareceria nela e passaria sem cobertura, calado. Este `Record` é
   * verificado pelo compilador: acrescentar um `SqlDialect` quebra aqui e
   * obriga a estender a tabela.
   */
  const ALL_DIALECTS: Readonly<Record<SqlDialect, true>> = {
    postgres: true,
    mysql: true,
    mssql: true,
    sqlite: true,
  };

  it('a tabela cobre todos os dialetos do contrato', () => {
    const covered = new Set(CAPABILITIES.map(([, c]) => c.dialect));

    expect([...covered].sort()).toEqual(Object.keys(ALL_DIALECTS).sort());
  });

  it('nenhum adapter usa `native` num dialeto sem escape default', () => {
    // SQLite e SQL Server não têm caractere de escape default no `LIKE`:
    // medido em SQLite, um padrão escapado com barra invertida e sem cláusula
    // `ESCAPE` casa a string literal, não o caractere pretendido. `native` ali
    // seria a promessa da §11 sem o mecanismo que a cumpre.
    const WITHOUT_DEFAULT_ESCAPE = new Set(['sqlite', 'mssql']);
    let checked = 0;

    for (const [id, capabilities] of CAPABILITIES) {
      if (!WITHOUT_DEFAULT_ESCAPE.has(capabilities.dialect)) continue;

      checked += 1;
      expect([id, capabilities.patternEscape]).not.toEqual([id, 'native']);
    }

    // Sem isto, o teste passaria assertando nada no dia em que o laço deixasse
    // de casar — um verde que não prova coisa alguma.
    expect(checked).toBe(4);
  });
});
