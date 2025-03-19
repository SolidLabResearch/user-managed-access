import { HttpHandlerContext } from './HttpHandlerContext';
import { HttpHandlerRoute } from './HttpHandlerRoute';

export class HttpHandlerController<C extends HttpHandlerContext = HttpHandlerContext> {

  constructor(
    public routes: HttpHandlerRoute<C>[],
  ) { }

}
