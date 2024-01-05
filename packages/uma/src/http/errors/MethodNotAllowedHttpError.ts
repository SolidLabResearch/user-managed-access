
import { HttpError } from './HttpError';

/**
 * An error thrown when data was found for the requested identifier, but is not supported by the target resource.
 */
export class MethodNotAllowedHttpError extends HttpError {

  constructor(message?: string) {

    super(405, 'MethodNotAllowedHttpError', message);

  }

  static isInstance(error: unknown): error is MethodNotAllowedHttpError {

    const errorIsInstance = HttpError.isInstance(error) && error.statusCode === 405;

    this.logger.info(`Checking if ${error} is an instance of ${this.name}: `, errorIsInstance);

    return errorIsInstance;

  }

}