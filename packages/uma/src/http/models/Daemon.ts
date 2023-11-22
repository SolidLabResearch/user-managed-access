import { Observable } from 'rxjs';

/**
 * This class represents typically long-running daemon processes that can be started and stopped.
 */
export abstract class Daemon {

  /**
   * Start the server
   */
  abstract start(): Observable<Daemon>;

  /**
   * Stop the server
   */
  abstract stop(): Observable<Daemon>;

}
