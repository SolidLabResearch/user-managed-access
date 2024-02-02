/* eslint-disable valid-jsdoc */
/* eslint-disable require-jsdoc */

import * as util from 'util';
import {transports, createLogger, format, Logger as WLogger} from 'winston';
import {Logger, LoggerLevel} from './Logger';
import {TransformableInfo} from 'logform';
import * as fs from 'fs';

/**
 * Winston-based logger service
 *
 * @note this logger will disable console logging output during testing
 */
export class WinstonLogger extends Logger {
  private logger: WLogger;

  constructor(
    public readonly label: string,
    protected readonly minimumLevel: LoggerLevel,
    protected readonly minimumLevelPrintData: LoggerLevel,
  ) {
    super(label, minimumLevel, minimumLevelPrintData);

    this.logger = createLogger({
      format: format.combine(
          format.timestamp(),
          format.colorize(),
          format.printf(this.formatLog),
      ),
      level: LoggerLevel[this.minimumLevel],
      transports: [process.env.NODE_ENV !== 'test' ?
        new transports.Console() : new transports.Stream({
          stream: fs.createWriteStream('/dev/null'),
        }),
      ],
    });
  }

  log(level: LoggerLevel, message: string, data?: unknown): void {
    const logLevel = LoggerLevel[level];
    const printData = level <= this.minimumLevelPrintData;

    if (level >= this.minimumLevel) {
      this.logger.log({level: logLevel, message, typeName: this.label, data, printData});
    }
  }

  /**
   * Formats log info
   *
   * @param info The log info to format
   * @return The formatted string
   */
  public formatLog(info: TransformableInfo): string {
    return info.printData ?
      `${info.timestamp} [${info.typeName}] ${info.level}: ${info.message}${info.data ?
        `\n${util.inspect(info.data)}` : ''}` :
      `${info.timestamp} [${info.typeName}] ${info.level}: ${info.message}`;
  }
}
