import { DynamicQueryBuilderModule } from '@core/dynamic-query-builder.module';
import { RestQueryError } from '@core/errors';

describe('DynamicQueryBuilderModule.forRoot', () => {
  /**
   * O bloco de exemplo da §8.2 do design traz `defaultPerPage: 20`, e este
   * teste já fixou esse número. Ele é `10` — a Emenda 4 da ADR-001 desfez a
   * troca, que nunca foi decidida: nenhum documento a justifica, e ela era a
   * única mudança breaking da v3 que não trocava um comportamento errado por
   * um certo. Dobrava calada o payload de quem nunca configurou paginação.
   */
  it('aplica os defaults, com paginação pela Emenda 4 da ADR-001', () => {
    DynamicQueryBuilderModule.forRoot({});
    expect(DynamicQueryBuilderModule.config).toEqual({
      pagination: { defaultPerPage: 10, maxPerPage: 100 },
      textProfile: 'portable-strict',
      consistency: 'eventual',
      logging: { enabled: false, level: 'info', redactValues: true },
    });
  });

  it('congela a configuração', () => {
    DynamicQueryBuilderModule.forRoot({});
    expect(Object.isFrozen(DynamicQueryBuilderModule.config)).toBe(true);
    expect(Object.isFrozen(DynamicQueryBuilderModule.config.pagination)).toBe(
      true
    );
  });

  it('provê o serviço e o token de configuração', () => {
    const module = DynamicQueryBuilderModule.forRoot({});
    expect(module.providers).toHaveLength(2);
    expect(module.exports).toHaveLength(1);
  });

  it('rejeita a chave adapter da v2', () => {
    expect(() =>
      DynamicQueryBuilderModule.forRoot({ adapter: {} } as never)
    ).toThrow(RestQueryError);
  });

  it('rejeita a chave operators da v2', () => {
    expect(() =>
      DynamicQueryBuilderModule.forRoot({ operators: {} } as never)
    ).toThrow(/operators/);
  });

  it('rejeita maxPerPage menor que defaultPerPage', () => {
    expect(() =>
      DynamicQueryBuilderModule.forRoot({
        pagination: { defaultPerPage: 50, maxPerPage: 10 },
      })
    ).toThrow(
      expect.objectContaining({ code: 'SOURCE_CONFIGURATION_INVALID' })
    );
  });

  it('rejeita defaultPerPage abaixo de 1', () => {
    expect(() =>
      DynamicQueryBuilderModule.forRoot({
        pagination: { defaultPerPage: 0, maxPerPage: 10 },
      })
    ).toThrow(
      expect.objectContaining({ code: 'SOURCE_CONFIGURATION_INVALID' })
    );
  });

  it('mescla parcialmente a paginação', () => {
    DynamicQueryBuilderModule.forRoot({ pagination: { maxPerPage: 50 } });
    expect(DynamicQueryBuilderModule.config.pagination).toEqual({
      defaultPerPage: 10,
      maxPerPage: 50,
    });
  });
});

/**
 * Opção declarada tem de fazer o que promete, ou não ser aceita.
 *
 * As duas chaves abaixo eram configuráveis e inúteis: `database-native` não
 * mudava compilação nenhuma — só desligava a checagem de portabilidade, o que
 * deixava o consumidor com o pior dos dois mundos — e `transactional` reprovava
 * cada requisição, porque nenhum adapter embarcado oferece a garantia. A §17
 * decide as duas: configuração inválida falha na inicialização.
 */
describe('DynamicQueryBuilderModule.forRoot e opções reservadas', () => {
  it('recusa textProfile database-native na inicialização', () => {
    expect(() =>
      DynamicQueryBuilderModule.forRoot({ textProfile: 'database-native' })
    ).toThrow(
      expect.objectContaining({
        code: 'SOURCE_CONFIGURATION_INVALID',
        statusCode: 500,
      })
    );
  });

  it('diz que o perfil é reservado, e não apenas inválido', () => {
    expect(() =>
      DynamicQueryBuilderModule.forRoot({ textProfile: 'database-native' })
    ).toThrow(/reserved and not implemented/);
  });

  it('aceita o textProfile implementado', () => {
    expect(() =>
      DynamicQueryBuilderModule.forRoot({ textProfile: 'portable-strict' })
    ).not.toThrow();
  });

  it('recusa consistency transactional na inicialização', () => {
    expect(() =>
      DynamicQueryBuilderModule.forRoot({ consistency: 'transactional' })
    ).toThrow(
      expect.objectContaining({
        code: 'SOURCE_CONFIGURATION_INVALID',
        statusCode: 500,
      })
    );
  });

  it('explica que a recusa seria por requisição, e nomeia o código', () => {
    expect(() =>
      DynamicQueryBuilderModule.forRoot({ consistency: 'transactional' })
    ).toThrow(/CAPABILITY_UNAVAILABLE/);
  });

  it('aceita a consistência que os adapters oferecem', () => {
    expect(() =>
      DynamicQueryBuilderModule.forRoot({ consistency: 'eventual' })
    ).not.toThrow();
  });

  it('mantém os defaults quando as chaves reservadas são omitidas', () => {
    DynamicQueryBuilderModule.forRoot({});
    expect(DynamicQueryBuilderModule.config.textProfile).toBe(
      'portable-strict'
    );
    expect(DynamicQueryBuilderModule.config.consistency).toBe('eventual');
  });
});
