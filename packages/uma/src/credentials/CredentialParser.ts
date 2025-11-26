import { AsyncHandler } from 'asynchronous-handlers';
import { HttpHandlerRequest } from '../util/http/models/HttpHandler';
import { Credential } from './Credential';

/**
 * Converts the contents of a request to a Credential token,
 * generally by parsing the Authorization header.
 */
export abstract class CredentialParser extends AsyncHandler<HttpHandlerRequest, Credential> {}
