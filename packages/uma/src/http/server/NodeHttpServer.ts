/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { createServer, IncomingMessage, ServerResponse, Server as NodeServer } from 'http';
import { Subject } from 'rxjs';
import { getLogger } from '../../logging/LoggerUtils';
import { Server } from '../models/Server';
import { NodeHttpStreams } from './NodeHttpStreams';
import { NodeHttpStreamsHandler } from './NodeHttpStreamsHandler';

/**
 * A { Server } implemented with [Node.js HTTP]{@link https://nodejs.org/api/http.html}, handling requests through a { NodeHttpStreamsHandler }.
 */
export class NodeHttpServer extends Server {

  private server: NodeServer;
  private logger = getLogger();

  /**
   * Creates a { NodeHttpServer } listening on `http://``host``:``port`, passing requests through the given { NodeHttpStreamsHandler }.
   *
   * @param { string } host- the host name on which to listen
   * @param { number } port - the port number on which to listen
   * @param { NodeHttpStreamsHandler } nodeHttpStreamsHandler - the handler handling incoming requests
   * @constructor
   */
  constructor(
    protected host: string,
    protected port: number,
    private nodeHttpStreamsHandler: NodeHttpStreamsHandler,
  ) {

    super(`http`, host, port);

    if (!host) {

      throw new Error('A host must be provided');

    }

    if (!port) {

      throw new Error('A port must be provided');

    }

    if (!nodeHttpStreamsHandler) {

      throw new Error('A handler must be provided');

    }

    this.server = createServer(this.serverHelper.bind(this));

  }

  /**
   * @override
   * { @inheritDoc Server.start }
   */
  start() {

    const subject = new Subject<this>();

    this.server.on(('error'), (err: unknown) => {

      this.logger.fatal(`The server ran into a problem: `, { error: err });
      subject.error(new Error(`The server ran into a problem: ${err}`));

    });

    this.server.on('listening', () => {

      subject.next(this);
      subject.complete();

    });

    this.server.listen(this.port, this.host);
    this.logger.info(`The server is listening on ${this.host}:${this.port}`);

    return subject;

  }

  /**
   * @override
   * { @inheritDoc Server.start }
   */
  stop() {

    const subject = new Subject<this>();

    this.server.on(('error'), (err: unknown) => {

      this.logger.fatal(`The server ran into a problem: `, { error: err });
      subject.error(new Error(`The server ran into a problem: ${err}`));

    });

    this.server.on('close', () => {

      subject.next(this);
      subject.complete();

    });

    this.logger.info(`The server is closing`);
    this.server.close();

    return subject;

  }

  /**
   * Helper function that provides a callback through which the Node.js HTTP server
   * can send requests. It combines the IncomingMessage and ServerResponse into
   * a NodeHttpStreams and passes it through the handler.
   *
   * @param { IncomingMessage } req - the Node.js HTTP callback's request stream
   * @param { ServerResponse } res - the Node.js HTTP callback's response stream
   */
  serverHelper(req: IncomingMessage, res: ServerResponse): void {

    if (!req) {

      this.logger.debug('No request received');
      throw new Error('request must be defined.');

    }

    if (!res) {

      this.logger.debug('No response received');
      throw new Error('response must be defined.');

    }

    const nodeHttpStreams: NodeHttpStreams = {
      requestStream: req,
      responseStream: res,
    };

    this.nodeHttpStreamsHandler.handle(nodeHttpStreams).subscribe();

  }

}
