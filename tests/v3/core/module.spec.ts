import { InternalServerErrorException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DynamicQueryBuilderModule } from '@core/dynamic-query-builder.module';
import { RestQueryError } from '@core/errors';
import { QueryBuilderService } from '@core/query-builder.v3.service';
import { fakeSource } from '../fixtures/fake-adapter';
import { RULES_PRESETS } from '../fixtures/rules';

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
      pagination: {
        defaultPerPage: 10,
        maxPerPage: 500,
        allowUnpaginated: true,
        maxUnpaginatedRows: 500,
      },
      textProfile: 'portable-strict',
      consistency: 'eventual',
      logging: { enabled: false, level: 'info', redactValues: true },
      portability: { enforce: false },
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
      allowUnpaginated: true,
      // Sem valor próprio, o teto sem paginação acompanha o `maxPerPage`.
      maxUnpaginatedRows: 50,
    });
  });
});

describe('regression: unpaginated global cap (consumer report #6) — forRoot', () => {
  it('aceita a política global de paginate=false', () => {
    DynamicQueryBuilderModule.forRoot({
      pagination: { allowUnpaginated: false, maxUnpaginatedRows: 1000 },
    });
    expect(DynamicQueryBuilderModule.config.pagination).toEqual({
      defaultPerPage: 10,
      maxPerPage: 500,
      allowUnpaginated: false,
      maxUnpaginatedRows: 1000,
    });
  });

  it.each([0, -1, 1.5, Number.NaN])(
    'recusa maxUnpaginatedRows=%p na inicialização',
    (maxUnpaginatedRows) => {
      expect(() =>
        DynamicQueryBuilderModule.forRoot({
          pagination: { maxUnpaginatedRows },
        })
      ).toThrow(
        expect.objectContaining({ code: 'SOURCE_CONFIGURATION_INVALID' })
      );
    }
  );

  it('recusa allowUnpaginated que não seja booleano', () => {
    expect(() =>
      DynamicQueryBuilderModule.forRoot({
        pagination: { allowUnpaginated: 'no' as never },
      })
    ).toThrow(
      expect.objectContaining({ code: 'SOURCE_CONFIGURATION_INVALID' })
    );
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

describe('regression: portability.enforce (consumer report #5) — forRoot', () => {
  it('guarda portability na configuração congelada', () => {
    DynamicQueryBuilderModule.forRoot({ portability: { enforce: true } });
    expect(DynamicQueryBuilderModule.config.portability).toEqual({
      enforce: true,
    });
    expect(Object.isFrozen(DynamicQueryBuilderModule.config.portability)).toBe(
      true
    );
  });

  it('recusa source sem portabilityProfile quando enforce é true', async () => {
    // O relato: `forRoot({ portability: { enforce: true } })` era descartado
    // ao congelar a configuração, e a source sem perfil passava calada.
    const moduleRef = await Test.createTestingModule({
      imports: [
        DynamicQueryBuilderModule.forRoot({ portability: { enforce: true } }),
      ],
    }).compile();
    const service = moduleRef.get(QueryBuilderService);

    const failure = await service
      .execute(fakeSource(), {}, RULES_PRESETS['user.default'])
      .then(
        () => undefined,
        (error: unknown) => error
      );

    expect(failure).toBeInstanceOf(InternalServerErrorException);
    expect(
      (failure as InternalServerErrorException).getResponse()
    ).toMatchObject({ code: 'PORTABILITY_PROFILE_MISMATCH' });
    await moduleRef.close();
  });

  it('mantém a checagem desligada por default', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DynamicQueryBuilderModule.forRoot({})],
    }).compile();
    const service = moduleRef.get(QueryBuilderService);

    await expect(
      service.execute(fakeSource(), {}, RULES_PRESETS['user.default'])
    ).resolves.toBeDefined();
    await moduleRef.close();
  });

  it.each(['yes', 1, null])(
    'recusa portability.enforce=%p na inicialização',
    (enforce) => {
      expect(() =>
        DynamicQueryBuilderModule.forRoot({
          portability: { enforce: enforce as never },
        })
      ).toThrow(
        expect.objectContaining({ code: 'SOURCE_CONFIGURATION_INVALID' })
      );
    }
  );
});
