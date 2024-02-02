import { Handler } from '../models/Handler';
import { NodeHttpStreams } from './NodeHttpStreams';

/**
 * A {Handler} that handles the IncomingMessage and ServerResponse of a {NodeHttpStreams} object.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export abstract class NodeHttpStreamsHandler extends Handler<NodeHttpStreams> { }
