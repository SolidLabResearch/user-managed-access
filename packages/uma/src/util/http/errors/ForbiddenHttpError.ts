import { HttpError } from './HttpError';

/**
 * An error thrown when an agent is not allowed to access data.
 */
export class ForbiddenHttpError extends HttpError {

  constructor(message?: string) {

    super(403, 'ForbiddenHttpError', message);

  }

  static isInstance(error: unknown): error is ForbiddenHttpError {

    const errorIsInstance = HttpError.isInstance(error) && error.statusCode === 403;

    this.logger.info(`Checking if ${error} is an instance of ${this.name}: `, errorIsInstance);

    return errorIsInstance;

  }

}
