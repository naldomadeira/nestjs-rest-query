import { DynamicQueryBuilderModule } from '@core/dynamic-query-builder.module';
import { RestQueryError } from '@core/errors';

describe('DynamicQueryBuilderModule.forRoot', () => {
  it('aplica os defaults do spec §8.2', () => {
    DynamicQueryBuilderModule.forRoot({});
    expect(DynamicQueryBuilderModule.config).toEqual({
      pagination: { defaultPerPage: 20, maxPerPage: 100 },
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
      defaultPerPage: 20,
      maxPerPage: 50,
    });
  });
});
