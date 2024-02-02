
export interface LoggerOptions {
  minimumLevel: LoggerLevel;
  minimumLevelPrintData: LoggerLevel;
}

export interface PinoLoggerOptions extends LoggerOptions {
  prettyPrint?: boolean;
}
/**
 * Level of log severity based on Bunyan's log levels
 */
export enum LoggerLevel {
  trace = 10,
  debug = 20,
  info = 30,
  warn = 40,
  error = 50,
  fatal = 60,
}

export abstract class Logger {

  public label: string;
  public variables: Record<string, string> = {};

  constructor(
    defaultLabel: string,
    protected readonly minimumLevel: LoggerLevel,
    protected readonly minimumLevelPrintData: LoggerLevel,
  ) {

    this.label = defaultLabel;

  }

  /**
   * Set the label of the logger
   *
   * @param label the string or class value that should be used as the label
   * @returns the Logger object
   */
  setLabel(label: string | { constructor: { name: string } }): Logger {

    this.label = typeof label === 'string' ? label : label.constructor.name;

    return this;

  }

  /**
   * set a variable that will be logged with every log message
   *
   * @param key key of the variable
   * @param value value of the variable
   * @returns the Logger object
   */
  setVariable(key: string, value: string): Logger {

    this.variables[key] = value;

    return this;

  }

  /**
   * Remove a variable from the logger
   *
   * @param key key of the variable
   * @returns the Logger object
   */
  removeVariable(key: string): Logger {

    delete this.variables[key];

    return this;

  }

  /**
   * Clear all variables from the logger
   *
   * @returns the Logger object
   */
  clearVariables(): Logger {

    this.variables = {};

    return this;

  }

  /**
   * retrieve the variables of the logger
   *
   * @returns the variables of the logger
   */
  getVariables(): Record<string, string> {

    return this.variables;

  }

  /**
   * Logs a fatal message
   *
   * @param message Message that should be logged
   * @param data Any relevant data that should be logged
   */
  fatal(message: string, data?: unknown): void {
    console.log(message, data) // note: fatal does not exist in winston...
    this.log(LoggerLevel.fatal, message, data);

  }

  /**
   * Logs an error message
   *
   * @param message Message that should be logged
   * @param data Any relevant data that should be logged
   */
  error(message: string, data?: unknown): void {

    this.log(LoggerLevel.error, message, data);

  }

  /**
   * Logs a warning message
   *
   * @param message Message that should be logged
   * @param data Any relevant data that should be logged
   */
  warn(message: string, data?: unknown): void {

    this.log(LoggerLevel.warn, message, data);

  }

  /**
   * Logs an info message
   *
   * @param message Message that should be logged
   * @param data Any relevant data that should be logged
   */
  info(message: string, data?: unknown): void {

    this.log(LoggerLevel.info, message, data);

  }

  /**
   * Logs a debug message
   *
   * @param message Message that should be logged
   * @param data Any relevant data that should be logged
   */
  debug(message: string, data?: unknown): void {

    this.log(LoggerLevel.debug, message, data);

  }

  /**
   * Logs a trace message
   *
   * @param message Message that should be logged
   * @param data Any relevant data that should be logged
   */
  trace(message: string, data?: unknown): void {

    this.log(LoggerLevel.trace, message, data);

  }

  /**
   * Logs a message
   *
   * @param level Severity level of the log
   * @param message Message that should be logged
   * @param data Any relevant data that should be logged
   */
  abstract log(level: LoggerLevel, message: string, data?: unknown): void;

}
