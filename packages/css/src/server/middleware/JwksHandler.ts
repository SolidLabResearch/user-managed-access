import type { HttpHandlerInput } from '@solid/community-server';
import { HttpHandler, JwkGenerator } from '@solid/community-server';

export class JwksHandler extends HttpHandler {

  constructor(
    private generator: JwkGenerator,
  ) {
    super();
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
