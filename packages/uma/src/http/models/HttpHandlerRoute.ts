import { HttpHandler } from './HttpHandler';
import { HttpHandlerContext } from './HttpHandlerContext';

export abstract class HttpHandlerOperationMediaPayload {
}

export abstract class HttpHandlerOperationMedia {

  constructor(
    public type: string,
    public example?: HttpHandlerOperationMediaPayload,
  ) {}

}

export abstract class HttpHandlerOperationHeader{

  constructor(
    public type: string,
    public description: string,
  ) {}

}

export abstract class HttpHandlerOperationResponse {

  constructor(
    public code: number,
    public description?: string,
    public body?: HttpHandlerOperationMedia[],
    public headers?: HttpHandlerOperationHeader[],
  ) {}

}

export enum HttpHandlerOperationSecurityType {
  BEARER = 'Bearer',
}

export abstract class HttpHandlerOperation {

  constructor(
    public method: string,
    public publish: boolean,
    public description?: string,
    public responses?: HttpHandlerOperationResponse[],
    public security?: HttpHandlerOperationSecurityType,
    public vary?: string[],
  ) {}

}

export abstract class HttpHandlerRoute<C extends HttpHandlerContext = HttpHandlerContext> {

  constructor(
    public operations: HttpHandlerOperation[],
    public path: string,
    public handler: HttpHandler<C>,
  ) {}

}
