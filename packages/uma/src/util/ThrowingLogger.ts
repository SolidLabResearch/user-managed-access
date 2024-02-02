import { Logger, LoggerLevel } from "./logging/Logger";

export type ErrorConstructor = { new(msg: string): Error };

export class ThrowingLogger extends Logger {
  constructor(private logger: Logger) {
    super(
      logger.label,
      logger['minimumLevel'],
      logger['minimumLevelPrintData'],
    );
  }
  
  /**
   * Logs and throws an error
   *
   * @param {ErrorConstructor} constructor - The error constructor.
   * @param {string} message - The error message.
   * @param {unknown} data - Optional data to log.
   * @param {LoggerLevel} level - The level to log, defaults to 'warn'.
   * 
   * @throws An Error constructed with the provided constructor, containing the
   * provided message.
   */
  throw(
    constructor: ErrorConstructor,
    message: string,
    data?: unknown, 
    level: LoggerLevel = LoggerLevel.warn
  ): never {
    this.logger.log(level, message, data);
    throw new constructor(message);
  }

  /* All other methods are implemented by the dependency. */

  setLabel(label: string | { constructor: { name: string; }; }): Logger { return this.logger.setLabel(label); }

  setVariable(key: string, value: string): Logger { return this.logger.setVariable(key, value); }
  removeVariable(key: string): Logger { return this.logger.removeVariable(key); }
  clearVariables(): Logger { return this.logger.clearVariables(); }
  getVariables(): Record<string, string> { return this.logger.getVariables(); }

  fatal(message: string, data?: unknown): void { return this.logger.fatal(message, data); }
  error(message: string, data?: unknown): void { return this.logger.error(message, data); }
  warn(message: string, data?: unknown): void { return this.logger.warn(message, data); }
  info(message: string, data?: unknown): void { return this.logger.info(message, data); }
  debug(message: string, data?: unknown): void { return this.logger.debug(message, data); }
  trace(message: string, data?: unknown): void { return this.logger.trace(message, data); }

  log(level: LoggerLevel, message: string, data?: unknown): void { return this.logger.log(level, message, data); }
}