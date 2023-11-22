import { HttpError } from './HttpError';

/**
 * A generic error message, given when an unexpected condition was encountered and no more specific message is suitable.
 */
export class InternalServerError extends HttpError {

  constructor(message?: string) {

    super(500, 'InternalServerError', message);

  }

  static isInstance(error: unknown): error is InternalServerError {

    const errorIsInstance = HttpError.isInstance(error) && error.statusCode === 500;

    this.logger.info(`Checking if ${error} is an instance of ${this.name}: `, errorIsInstance);

    return errorIsInstance;

  }

}
