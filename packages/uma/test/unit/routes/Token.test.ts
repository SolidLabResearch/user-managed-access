import { Mocked } from 'vitest';
import { Negotiator } from '../../../src/dialog/Negotiator';
import { NeedInfoError } from '../../../src/errors/NeedInfoError';
import { TokenRequestHandler } from '../../../src/routes/Token';
import { HttpHandler, HttpHandlerContext, HttpHandlerRequest } from '../../../src/util/http/models/HttpHandler';

describe('Token', (): void => {
  let request: HttpHandlerRequest;

  let negotiator: Mocked<Negotiator>;
  let umaProtection: Mocked<HttpHandler>;
  let handler: TokenRequestHandler;

  beforeEach(async(): Promise<void> => {
    request = {
      url: new URL('http://example.com/token'),
      parameters: {},
      method: 'POST',
      headers: {},
      body: {},
    };

    negotiator = {
      negotiate: vi.fn().mockResolvedValue('response'),
    };

    umaProtection = {
      handleSafe: vi.fn().mockResolvedValue({ status: 201, body: { access_token: 'pat' }}),
    } satisfies Partial<HttpHandler> as any;
    handler = new TokenRequestHandler(negotiator, umaProtection);
  });

  it('throws an error if the body is invalid.', async(): Promise<void> => {
    request.body = { ticket: 5 };
    await expect(handler.handle({ request })).rejects
      .toThrow('Invalid token request body: value is neither of the union types');
  });

  it('throws an error if the grant type is not supported.', async(): Promise<void> => {
    request.body = { grant_type: 'not supported' };
    await expect(handler.handle({ request })).rejects
      .toThrow('Unsupported grant_type not supported')
  });

  describe('generating an UMA token', (): void => {
    beforeEach(async(): Promise<void> => {
      request.body =  {
        ticket: 'ticket',
        grant_type: 'urn:ietf:params:oauth:grant-type:uma-ticket',
      };
    });

    it('returns the negotiated response.', async(): Promise<void> => {
      await expect(handler.handle({ request })).resolves.toEqual({ status: 200, body: 'response' });
      expect(negotiator.negotiate).toHaveBeenCalledTimes(1);
      expect(negotiator.negotiate).toHaveBeenLastCalledWith(request.body);
    });

    it('returns a 403 with the ticket if negotiation needs more info.', async(): Promise<void> => {
      const needInfo = new NeedInfoError('msg', 'ticket', { required_claims: [{ claim_token_format: 'format' }] });
      negotiator.negotiate.mockRejectedValueOnce(needInfo);
      await expect(handler.handle({ request })).resolves.toEqual({ status: 403, body: {
          ticket: 'ticket',
          required_claims: [{ claim_token_format: 'format' }],
        }});
    });

    it('throws an error if something else goes wrong.', async(): Promise<void> => {
      negotiator.negotiate.mockRejectedValueOnce(new Error('bad data'));
      await expect(handler.handle({ request })).rejects.toThrow('bad data');
    });
  });

  describe('delegating uma_protection requests', (): void => {
    beforeEach(async(): Promise<void> => {
      request.headers = {
        authorization: 'Basic encoded',
      };
      request.body =  {
        grant_type: 'not supported here',
        scope: 'uma_protection',
      };
    });

    it('returns the delegated response unchanged.', async(): Promise<void> => {
      const response = await handler.handle({ request });
      expect(response).toEqual({ status: 201, body: { access_token: 'pat' }});
      expect(umaProtection.handleSafe).toHaveBeenCalledTimes(1);
      expect(umaProtection.handleSafe).toHaveBeenLastCalledWith({ request });
      expect(negotiator.negotiate).toHaveBeenCalledTimes(0);
    });

    it('routes based on scope before checking if Token supports the grant type.', async(): Promise<void> => {
      umaProtection.handleSafe.mockResolvedValueOnce({ status: 400, body: { error: 'from-uma' }});
      await expect(handler.handle({ request })).resolves.toEqual({ status: 400, body: { error: 'from-uma' }});
      expect(umaProtection.handleSafe).toHaveBeenCalledTimes(1);
    });
  });
});
