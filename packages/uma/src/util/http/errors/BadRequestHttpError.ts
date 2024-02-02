import { HttpError } from './HttpError';

/**
 * An error thrown when incoming data is not supported.
 */
export class BadRequestHttpError extends HttpError {

  /**
   * Default message is 'The given input is not supported by the server configuration.'.
   *
   * @param message - Optional, more specific, message.
   */
  constructor(message?: string) {

    super(400, 'BadRequestHttpError', message ?? 'The given input is not supported by the server configuration.');

  }

  static isInstance(error: unknown): error is BadRequestHttpError {

    const errorIsInstance = HttpError.isInstance(error) && error.statusCode === 400;

    this.logger.info(`Checking if ${error} is an instance of ${this.name}: `, errorIsInstance);

    return errorIsInstance;

  }

}
