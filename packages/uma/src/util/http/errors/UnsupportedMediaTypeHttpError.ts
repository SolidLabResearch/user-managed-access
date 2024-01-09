import { HttpError } from './HttpError';

/**
 * An error thrown when the media type of incoming data is not supported by a parser.
 */
export class UnsupportedMediaTypeHttpError extends HttpError {

  constructor(message?: string) {

    super(415, 'UnsupportedMediaTypeHttpError', message);

  }

  static isInstance(error: unknown): error is UnsupportedMediaTypeHttpError {

    const errorIsInstance = HttpError.isInstance(error) && error.statusCode === 415;

    this.logger.info(`Checking if ${error} is an instance of ${this.name}: `, errorIsInstance);

    return errorIsInstance;

  }

}
