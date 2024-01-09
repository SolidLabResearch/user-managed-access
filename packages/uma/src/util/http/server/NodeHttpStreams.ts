import { IncomingMessage, ServerResponse } from 'http';

/**
 * A pair consisting of the IncomingMessage request steam and the ServerResponse response stream of the Node.js native HTTP library.
 */
export interface NodeHttpStreams {
  requestStream: IncomingMessage;
  responseStream: ServerResponse;
}
