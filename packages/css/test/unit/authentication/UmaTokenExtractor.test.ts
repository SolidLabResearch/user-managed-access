import { BadRequestHttpError, HttpRequest, NotImplementedHttpError, TargetExtractor } from '@solid/community-server';
import { Mocked } from 'vitest';
import { UmaTokenExtractor } from '../../../src/authentication/UmaTokenExtractor';
import { UmaClient } from '../../../src/uma/UmaClient';
import { OwnerUtil } from '../../../src/util/OwnerUtil';

describe('UmaTokenExtractor', () => {
  let client: Mocked<UmaClient>;
  let targetExtractor: Mocked<TargetExtractor>;
  let ownerUtil: Mocked<OwnerUtil>;
  let extractor: UmaTokenExtractor;

  beforeEach(async(): Promise<void> => {
    client = {
      verifyJwtToken: vi.fn().mockResolvedValue({ verified: true }),
    } satisfies Partial<UmaClient> as any;

    targetExtractor = {
      handleSafe: vi.fn().mockResolvedValue({ identifier: 'identifier' }),
    } satisfies Partial<TargetExtractor> as any;

    ownerUtil = {
      findOwners: vi.fn().mockResolvedValue([ 'owner' ]),
      findIssuer: vi.fn().mockResolvedValue('issuer'),
    } satisfies Partial<OwnerUtil> as any;

    extractor = new UmaTokenExtractor(client, targetExtractor, ownerUtil);
  });

  describe('on a request without Authorization header', () => {
    const request = {
      method: 'GET',
      headers: { },
    } as any as HttpRequest;
    it('throws an error', async () =>{
      const result = extractor.handleSafe(request);
      await expect(result).rejects.toThrow(NotImplementedHttpError);
      await expect(result).rejects.toThrow('No Bearer Authorization header specified.');
    });
  });

  describe('on a request without Bearer Authorization header', () => {
    const request = {
      method: 'GET',
      headers: {'authorization': 'Token 123'},
    } as any as HttpRequest;
    it('throws an error', async () =>{
      const result = extractor.handleSafe(request);
      await expect(result).rejects.toThrow(NotImplementedHttpError);
      await expect(result).rejects.toThrow('No Bearer Authorization header specified.');
    });
  });

  describe('on a request with Bearer Authorization header', () => {
    const request = {
      method: 'GET',
      headers: {
        authorization: 'Bearer 123',
      },
    } as any as HttpRequest;

    it('calls the verifier with correct parameters', async () =>{
      await expect(extractor.handleSafe(request)).resolves.toEqual({ uma: { rpt: { verified: true }}});
      expect(client.verifyJwtToken).toHaveBeenCalledTimes(1);
      expect(client.verifyJwtToken).toHaveBeenCalledWith('123', [ 'issuer' ]);
    });

    it('returns the verified token', async () => {
      const result = extractor.handleSafe(request);
      await expect(result).resolves.toEqual({ uma: { rpt: { verified: true }}});
    });
  });

  describe('on a request with Bearer Authorization header and unsupported token', () => {
    const request = {
      method: 'GET',
      headers: {'authorization': 'Bearer 123'},
    } as any as HttpRequest;

    beforeEach(() => {
      client.verifyJwtToken.mockRejectedValueOnce(new Error('bad data'));
    });

    it('throws an error.', async () =>{
      const result = extractor.handleSafe(request);
      await expect(result).rejects.toThrow(BadRequestHttpError);
      await expect(result).rejects.toThrow('Error verifying WebID via Bearer access token: bad data');
    });
  });
});
