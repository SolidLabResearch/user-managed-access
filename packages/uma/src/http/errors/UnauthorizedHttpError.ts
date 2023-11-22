import { HttpError } from './HttpError';

/**
 * An error thrown when an agent is not authorized.
 */
export class UnauthorizedHttpError extends HttpError {

  constructor(message?: string) {

    super(401, 'UnauthorizedHttpError', message);

  }

  static isInstance(error: unknown): error is UnauthorizedHttpError {

    const errorIsInstance = HttpError.isInstance(error) && error.statusCode === 401;

    this.logger.info(`Checking if ${error} is an instance of ${this.name}: `, errorIsInstance);

    return errorIsInstance;

  }

}
