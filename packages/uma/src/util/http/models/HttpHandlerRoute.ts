import { HttpHandler, HttpHandlerContext } from './HttpHandler';

export abstract class HttpHandlerRoute<C extends HttpHandlerContext = HttpHandlerContext> {
  constructor(
    public path: string,
    public handler: HttpHandler<C>,
    public methods?: string[],
  ) {}
}
