import { HttpHandler } from './HttpHandler';
import { HttpHandlerContext } from './HttpHandlerContext';

export abstract class HttpHandlerRoute<C extends HttpHandlerContext = HttpHandlerContext> {
  constructor(
    public path: string,
    public handler: HttpHandler<C>,
    public methods?: string[],
  ) {}
}
