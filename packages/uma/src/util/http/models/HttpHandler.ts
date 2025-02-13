import { AsyncHandler } from '@solid/community-server';
import { HttpHandlerResponse } from './HttpHandlerResponse';
import { HttpHandlerContext } from './HttpHandlerContext';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export abstract class HttpHandler<C extends HttpHandlerContext = HttpHandlerContext>
  extends AsyncHandler<C, HttpHandlerResponse> { }
