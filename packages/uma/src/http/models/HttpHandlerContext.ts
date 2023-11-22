import { HttpHandlerRequest } from './HttpHandlerRequest';
import { HttpHandlerRoute } from './HttpHandlerRoute';

export interface HttpHandlerContext {
  request: HttpHandlerRequest;
  route?: HttpHandlerRoute;
}
