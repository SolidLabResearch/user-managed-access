
/**
 * This class represents typically long-running daemon processes that can be started and stopped.
 */
export abstract class Daemon {

  /**
   * Start the server
   */
  abstract start(): Promise<Daemon>;

  /**
   * Stop the server
   */
  abstract stop(): Promise<Daemon>;

}
