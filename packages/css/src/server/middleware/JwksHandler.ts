import type { HttpHandlerInput } from '@solid/community-server';
import { HttpHandler, JwkGenerator, MethodNotAllowedHttpError, NotImplementedHttpError } from '@solid/community-server';

export class JwksHandler extends HttpHandler {

  constructor(
    private path: string,
    private generator: JwkGenerator,
  ) {
    super();
  }

  public async canHandle({ request }: HttpHandlerInput): Promise<void> {
    const { method, url } = request;

    if (!['GET', 'HEAD'].includes(method ?? '')) {
      throw new MethodNotAllowedHttpError(
        method ? [ method ] : undefined, 
        `Only GET or HEAD requests can target the storage description.`
      );
    }
    
    if (url !== this.path) throw new NotImplementedHttpError(`This handler is not configured for ${url}`);
  }


  public async handle({ request, response }: HttpHandlerInput): Promise<void> {
    const key = await this.generator.getPublicKey();

    response.writeHead(200, {
      'content-type': 'application/json',
    });

    if (request.method === 'HEAD') {
      response.end();
      return;
    }

    response.end(JSON.stringify({ keys: [ Object.assign(key, { kid: 'TODO' }) ] }));
  }
}
