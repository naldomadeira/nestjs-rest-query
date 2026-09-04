import { StructuredLogger } from '@infra/structured-logger';

const spyLogger = () => ({
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn(),
  debug: jest.fn(),
});

describe('StructuredLogger', () => {
  it('não emite nada quando desabilitado', () => {
    const logger = spyLogger();
    const structured = new StructuredLogger({ logger });

    structured.error('e');
    structured.warn('w');
    structured.info('i');
    structured.debug('d');

    for (const method of Object.values(logger)) {
      expect(method).not.toHaveBeenCalled();
    }
  });

  it('passa metadados como objeto separado, não concatenado', () => {
    const logger = spyLogger();
    new StructuredLogger({ enabled: true, level: 'debug', logger }).debug(
      'plan',
      { model: 'user' }
    );

    expect(logger.debug).toHaveBeenCalledWith('plan', { model: 'user' });
  });

  it('respeita o nível configurado', () => {
    const logger = spyLogger();
    const structured = new StructuredLogger({
      enabled: true,
      level: 'warn',
      logger,
    });

    structured.warn('w');
    structured.info('i');
    structured.debug('d');

    expect(logger.warn).toHaveBeenCalled();
    expect(logger.log).not.toHaveBeenCalled();
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('error ignora o nível, porque nunca deve ser silenciado', () => {
    const logger = spyLogger();
    new StructuredLogger({ enabled: true, level: 'error', logger }).error('e');
    expect(logger.error).toHaveBeenCalledWith('e', undefined);
  });

  it('usa info quando o logger o expõe, e log quando não', () => {
    const withInfo = { ...spyLogger(), info: jest.fn() };
    new StructuredLogger({ enabled: true, logger: withInfo }).info('i');
    expect(withInfo.info).toHaveBeenCalledWith('i', undefined);

    const withoutInfo = spyLogger();
    new StructuredLogger({ enabled: true, logger: withoutInfo }).info('i');
    expect(withoutInfo.log).toHaveBeenCalledWith('i', undefined);
  });

  it('redige valores por default', () => {
    expect(new StructuredLogger({}).redactValues).toBe(true);
    expect(new StructuredLogger({ redactValues: false }).redactValues).toBe(
      false
    );
  });
});
