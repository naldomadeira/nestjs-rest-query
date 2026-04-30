import { DQBLogger } from '@src/infra/logger';

function makeMockLogger() {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
  };
}

describe('DQBLogger', () => {
  describe('disabled (default)', () => {
    it('does not call inner logger when enabled is false', () => {
      const inner = makeMockLogger();
      const logger = new DQBLogger({ enabled: false, logger: inner });
      logger.error('e');
      logger.warn('w');
      logger.info('i');
      logger.debug('d');
      expect(inner.error).not.toHaveBeenCalled();
      expect(inner.warn).not.toHaveBeenCalled();
      expect(inner.info).not.toHaveBeenCalled();
      expect(inner.debug).not.toHaveBeenCalled();
    });

    it('noop() instance suppresses all output', () => {
      const noop = DQBLogger.noop();
      expect(() => {
        noop.error('e');
        noop.warn('w');
        noop.info('i');
        noop.debug('d');
      }).not.toThrow();
    });

    it('noop() always returns the same instance', () => {
      expect(DQBLogger.noop()).toBe(DQBLogger.noop());
    });
  });

  describe('enabled', () => {
    it('calls inner.error when enabled', () => {
      const inner = makeMockLogger();
      const logger = new DQBLogger({ enabled: true, logger: inner });
      logger.error('boom');
      expect(inner.error).toHaveBeenCalledWith('boom');
    });

    it('includes serialized meta in message', () => {
      const inner = makeMockLogger();
      const logger = new DQBLogger({ enabled: true, logger: inner });
      logger.error('failed', { code: 42 });
      expect(inner.error).toHaveBeenCalledWith('failed {"code":42}');
    });

    it('omits meta when not provided', () => {
      const inner = makeMockLogger();
      const logger = new DQBLogger({ enabled: true, logger: inner });
      logger.warn('simple');
      expect(inner.warn).toHaveBeenCalledWith('simple');
    });
  });

  describe('level threshold', () => {
    it('level "error" suppresses warn, info, debug', () => {
      const inner = makeMockLogger();
      const logger = new DQBLogger({ enabled: true, level: 'error', logger: inner });
      logger.warn('w');
      logger.info('i');
      logger.debug('d');
      expect(inner.warn).not.toHaveBeenCalled();
      expect(inner.info).not.toHaveBeenCalled();
      expect(inner.debug).not.toHaveBeenCalled();
    });

    it('level "error" still allows error', () => {
      const inner = makeMockLogger();
      const logger = new DQBLogger({ enabled: true, level: 'error', logger: inner });
      logger.error('e');
      expect(inner.error).toHaveBeenCalled();
    });

    it('level "warn" suppresses info and debug', () => {
      const inner = makeMockLogger();
      const logger = new DQBLogger({ enabled: true, level: 'warn', logger: inner });
      logger.info('i');
      logger.debug('d');
      expect(inner.info).not.toHaveBeenCalled();
      expect(inner.debug).not.toHaveBeenCalled();
    });

    it('level "warn" allows error and warn', () => {
      const inner = makeMockLogger();
      const logger = new DQBLogger({ enabled: true, level: 'warn', logger: inner });
      logger.error('e');
      logger.warn('w');
      expect(inner.error).toHaveBeenCalled();
      expect(inner.warn).toHaveBeenCalled();
    });

    it('level "info" suppresses debug', () => {
      const inner = makeMockLogger();
      const logger = new DQBLogger({ enabled: true, level: 'info', logger: inner });
      logger.debug('d');
      expect(inner.debug).not.toHaveBeenCalled();
    });

    it('level "info" allows error, warn, info', () => {
      const inner = makeMockLogger();
      const logger = new DQBLogger({ enabled: true, level: 'info', logger: inner });
      logger.error('e');
      logger.warn('w');
      logger.info('i');
      expect(inner.error).toHaveBeenCalled();
      expect(inner.warn).toHaveBeenCalled();
      expect(inner.info).toHaveBeenCalled();
    });

    it('level "debug" allows all', () => {
      const inner = makeMockLogger();
      const logger = new DQBLogger({ enabled: true, level: 'debug', logger: inner });
      logger.error('e');
      logger.warn('w');
      logger.info('i');
      logger.debug('d');
      expect(inner.error).toHaveBeenCalled();
      expect(inner.warn).toHaveBeenCalled();
      expect(inner.info).toHaveBeenCalled();
      expect(inner.debug).toHaveBeenCalled();
    });

    it('defaults to level "info" when not specified', () => {
      const inner = makeMockLogger();
      const logger = new DQBLogger({ enabled: true, logger: inner });
      logger.info('i');
      logger.debug('d');
      expect(inner.info).toHaveBeenCalled();
      expect(inner.debug).not.toHaveBeenCalled();
    });
  });

  describe('info fallback to log', () => {
    it('calls inner.log when inner has no info method', () => {
      const inner = { error: jest.fn(), warn: jest.fn(), log: jest.fn(), debug: jest.fn() };
      const logger = new DQBLogger({ enabled: true, level: 'info', logger: inner });
      logger.info('hello');
      expect(inner.log).toHaveBeenCalledWith('hello');
    });

    it('calls inner.info when available (does not fall back to log)', () => {
      const inner = makeMockLogger();
      const logger = new DQBLogger({ enabled: true, level: 'info', logger: inner });
      logger.info('hello');
      expect(inner.info).toHaveBeenCalledWith('hello');
      expect(inner.log).not.toHaveBeenCalled();
    });
  });

  describe('withContext', () => {
    it('prefixes message with [contextName]', () => {
      const inner = makeMockLogger();
      const logger = new DQBLogger({ enabled: true, level: 'debug', logger: inner });
      const ctx = logger.withContext('applyFilters');
      ctx.error('failed');
      expect(inner.error).toHaveBeenCalledWith('[applyFilters] failed');
    });

    it('prefixes all log levels', () => {
      const inner = makeMockLogger();
      const logger = new DQBLogger({ enabled: true, level: 'debug', logger: inner });
      const ctx = logger.withContext('handler');
      ctx.warn('w');
      ctx.info('i');
      ctx.debug('d');
      expect(inner.warn).toHaveBeenCalledWith('[handler] w');
      expect(inner.info).toHaveBeenCalledWith('[handler] i');
      expect(inner.debug).toHaveBeenCalledWith('[handler] d');
    });

    it('includes meta in prefixed message', () => {
      const inner = makeMockLogger();
      const logger = new DQBLogger({ enabled: true, level: 'debug', logger: inner });
      const ctx = logger.withContext('sort');
      ctx.debug('processing', { count: 3 });
      expect(inner.debug).toHaveBeenCalledWith('[sort] processing {"count":3}');
    });

    it('suppresses output when logger is disabled', () => {
      const inner = makeMockLogger();
      const logger = new DQBLogger({ enabled: false, logger: inner });
      const ctx = logger.withContext('any');
      ctx.error('e');
      ctx.warn('w');
      expect(inner.error).not.toHaveBeenCalled();
      expect(inner.warn).not.toHaveBeenCalled();
    });
  });
});
