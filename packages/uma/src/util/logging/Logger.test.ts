/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { LoggerLevel, Logger } from './Logger';

class MockLogger extends Logger {

  log(level: LoggerLevel, message: string, data?: unknown): void {

    throw new Error('Method not implemented.');

  }

  constructor(minimumLevel: LoggerLevel, minimumLevelPrintData: LoggerLevel) {

    super('test-logger', minimumLevel, minimumLevelPrintData);

  }

}

describe('Logger', () => {

  let logger: Logger;

  const message = 'message';
  const data = { data: 'data' };

  beforeEach(() => {

    logger = new MockLogger(LoggerLevel.trace, LoggerLevel.trace);
    logger.log = jest.fn();

  });

  describe('setLabel', () => {

    it('should set the label', () => {

      expect(logger.label).toBe('test-logger');

      logger.setLabel('new-label');

      expect(logger.label).toBe('new-label');

      logger.setLabel({ constructor: { name: 'new-label-constructor' } });

      expect(logger.label).toBe('new-label-constructor');

    });

  });

  describe('setVariable', () => {

    it('should set a variable', () => {

      expect(logger.variables).toEqual({});

      logger.setVariable('key', 'value');

      expect(logger.variables.key).toBe('value');

    });

  });

  describe('removeVariable', () => {

    it('should remove a variable', () => {

      expect(logger.variables).toEqual({});

      logger.setVariable('key', 'value');

      expect(logger.variables.key).toBe('value');

      logger.removeVariable('key');

      expect(logger.variables.key).toBeUndefined();

    });

  });

  describe('clearVariables', () => {

    it('should remove all variables', () => {

      expect(logger.variables).toEqual({});

      logger.setVariable('key', 'value');
      logger.setVariable('key2', 'value');

      expect(logger.variables.key).toBe('value');

      logger.clearVariables();

      expect(logger.variables.key).toBeUndefined();
      expect(Object.keys(logger.variables)).toHaveLength(0);

    });

  });

  describe('getVariables', () => {

    it('should return all variables', () => {

      expect(logger.variables).toEqual({});

      logger.setVariable('key', 'value');
      logger.setVariable('key2', 'value');

      expect(logger.getVariables()).toEqual({ key: 'value', key2: 'value' });

    });

  });

  it.each(
    Object.keys(LoggerLevel).filter((key) => isNaN(Number(key))),
  )('should call logger.log with %s and the correct parameters', (method) => {

    logger[method](message, data);

    expect(logger.log).toHaveBeenCalledWith(LoggerLevel[method], message, data);
    expect(logger.log).toHaveBeenCalledTimes(1);

  });

});
