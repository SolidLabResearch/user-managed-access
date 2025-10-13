import { Mocked } from 'vitest';
import { Negotiator } from '../../../src/dialog/Negotiator';
import { NeedInfoError } from '../../../src/errors/NeedInfoError';
import { TokenRequestHandler } from '../../../src/routes/Token';
import { HttpHandlerContext } from '../../../src/util/http/models/HttpHandler';

describe('Token', (): void => {
  let request: HttpHandlerContext;

  let negotiator: Mocked<Negotiator>;
  let handler: TokenRequestHandler;

  beforeEach(async(): Promise<void> => {
    request = { request: { body: {
          ticket: 'ticket',
          grant_type: 'urn:ietf:params:oauth:grant-type:uma-ticket'
        }}} as any;

    negotiator = {
      negotiate: vi.fn().mockResolvedValue('response'),
    };

    handler = new TokenRequestHandler(negotiator);
  });

  it('throws an error if the body is invalid.', async(): Promise<void> => {
    request.request.body = { ticket: 5 };
    await expect(handler.handle(request)).rejects
      .toThrow('Invalid token request body: value is neither of the union types');
  });

  it('throws an error if the grant type is not supported.', async(): Promise<void> => {
    request.request.body = { grant_type: 'not supported' };
    await expect(handler.handle(request)).rejects
      .toThrow("Expected 'grant_type' to be set to 'urn:ietf:params:oauth:grant-type:uma-ticket'")
  });

  it('returns the negotiated response.', async(): Promise<void> => {
    await expect(handler.handle(request)).resolves.toEqual({ status: 200, body: 'response' });
    expect(negotiator.negotiate).toHaveBeenCalledTimes(1);
    expect(negotiator.negotiate).toHaveBeenLastCalledWith(request.request.body);
  });

  it('returns a 403 with the ticket if negotiation needs more info.', async(): Promise<void> => {
    const needInfo = new NeedInfoError('msg', 'ticket', { required_claims: { claim_token_format: [[ 'format' ]] } });
    negotiator.negotiate.mockRejectedValueOnce(needInfo);
    await expect(handler.handle(request)).resolves.toEqual({ status: 403, body: {
        ticket: 'ticket',
        required_claims: { claim_token_format: [[ 'format' ]] },
      }});
  });

  it('throws an error if something else goes wrong.', async(): Promise<void> => {
    negotiator.negotiate.mockRejectedValueOnce(new Error('bad data'));
    await expect(handler.handle(request)).rejects.toThrow('bad data');
  });
});
