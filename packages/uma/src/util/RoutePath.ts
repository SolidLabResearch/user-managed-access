/**
 * Defines a route, constructed as baseUrl
 * and a static path segment which is appended
 */
export class RoutePath {
  /**
     * @param {string} baseUrl
     * @param {string} staticPath
     */
  constructor(private readonly baseUrl: string, private readonly staticPath: string) {

  }

  /**
   * Get the resulting URI for the Path
   * @return {string}
   */
  public getUri(): string {
    return `${this.baseUrl}${this.staticPath}`;
  }
}
