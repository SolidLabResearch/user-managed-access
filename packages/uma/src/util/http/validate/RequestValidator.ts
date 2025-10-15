import { AsyncHandler } from 'asynchronous-handlers';
import { HttpHandlerRequest } from '../models/HttpHandler';

export interface RequestValidatorInput {
  request: HttpHandlerRequest,
}

export interface RequestValidatorOutput {
  owner: string;
}

/**
 * Validates if a request is valid.
 * Returns the associated owner that performed this request.
 */
export abstract class RequestValidator extends AsyncHandler<RequestValidatorInput, RequestValidatorOutput> {}
