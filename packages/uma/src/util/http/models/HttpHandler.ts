import { Handler } from './Handler';
import { HttpHandlerResponse } from './HttpHandlerResponse';
import { HttpHandlerContext } from './HttpHandlerContext';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export abstract class HttpHandler<C extends HttpHandlerContext = HttpHandlerContext>
  extends Handler<C, HttpHandlerResponse> { }
