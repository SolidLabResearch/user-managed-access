import { types } from 'util';
import { getLogger } from '../../logging/LoggerUtils';

/**
 * A class for all errors that could be thrown by Solid.
 * All errors inheriting from this should fix the status code thereby hiding the HTTP internals from other components.
 */
export class HttpError extends Error {

  protected static readonly statusCode: number;
  public readonly statusCode: number;
  protected static readonly logger = getLogger();

  /**
   * Creates a new HTTP error. Subclasses should call this with their fixed status code.
   *
   * @param statusCode - HTTP status code needed for the HTTP response.
   * @param name - Error name. Useful for logging and stack tracing.
   * @param message - Message to be thrown.
   */
  constructor(statusCode: number, name: string, message?: string) {

    super(message);
    this.statusCode = statusCode;
    this.name = name;

  }

  static isInstance(error: unknown): error is HttpError {

    this.logger.info(`Checking if ${error} is an instance of ${this.name}`);

    return types.isNativeError(error) && Object.entries(error).find(
      ([ key, val ]) => key === 'statusCode' && typeof val === 'number'
    ) !== undefined;

  }

}
