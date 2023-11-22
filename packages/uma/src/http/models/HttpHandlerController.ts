import { Handler } from './Handler';
import { HttpHandlerContext } from './HttpHandlerContext';
import { HttpHandlerRoute } from './HttpHandlerRoute';

export class HttpHandlerController<C extends HttpHandlerContext = HttpHandlerContext> {

  constructor(
    public label: string,
    public routes: HttpHandlerRoute<C>[],
    public preResponseHandler?: Handler<HttpHandlerContext, C>,
  ) { }

}
