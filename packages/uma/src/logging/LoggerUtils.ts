/* eslint-disable @typescript-eslint/consistent-type-assertions */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {LoggerLevel, Logger} from './Logger';
import {WinstonLogger} from './WinstonLogger';

const loggerLevel = LoggerLevel.debug;
const loggerMinimumPrintLevel = LoggerLevel.debug;

/**
 * Gets a logger instance for the given class instance.
 *
 * @param {string | { constructor: { name: string } }} loggable - A class instance or a class string name.
 * @return {Logger}
 */
export const getLoggerFor = (
    loggable: string | { constructor: { name: string } },
): Logger => {
    return new WinstonLogger(typeof loggable === 'string' ? loggable : loggable.constructor.name,
    loggerLevel, loggerMinimumPrintLevel);
};

const loggerKey = '__LOGGER__HANDLERSJS__LOGGING__';

const getGlobalLogger = (): Logger => (global as any)[loggerKey];

const setGlobalLogger = (newLogger: Logger): void => {

  (global as any)[loggerKey] = newLogger;

};

export const setLogger = (
  logger: Logger,
): void => {

  setGlobalLogger(logger);

};

export const getLogger = (): Logger => {

  const logger = getGlobalLogger();
  // if (!logger) throw new Error('No logger was set. Set a logger using setLogger()');

  return logger;

};

export const makeErrorLoggable = (error: unknown): Record<string, unknown> => {

  if (error instanceof Error) {

    return {
      message: error.message,
      name: error.name,
      stack: error.stack ? error.stack.split(/\n/) : [],
    };

  }

  return { 'error': 'not-an-error' };

};
