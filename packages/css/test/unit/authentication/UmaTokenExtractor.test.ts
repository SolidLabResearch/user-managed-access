import { BadRequestHttpError, HttpRequest, NotImplementedHttpError, TargetExtractor } from '@solid/community-server';
import { Mocked } from 'vitest';
import { UmaTokenExtractor } from '../../../src/authentication/UmaTokenExtractor';
import { UmaClaims, UmaClient } from '../../../src/uma/UmaClient';
import { OwnerUtil } from '../../../src/util/OwnerUtil';

describe('UmaTokenExtractor', () => {
  let client: Mocked<UmaClient>;
  let targetExtractor: Mocked<TargetExtractor>;
  let ownerUtil: Mocked<OwnerUtil>;
  let extractor: UmaTokenExtractor;

  beforeEach(async(): Promise<void> => {
    client = {
      verifyOpaqueToken: vi.fn().mockResolvedValue({ verified: true }),
      verifyJwtToken: vi.fn().mockResolvedValue({ verified: true }),
    } satisfies Partial<UmaClient> as any;

    targetExtractor = {
      handleSafe: vi.fn().mockResolvedValue({ identifier: 'identifier' }),
    } satisfies Partial<TargetExtractor> as any;

    ownerUtil = {
      findOwners: vi.fn().mockResolvedValue([ 'owner' ]),
      findUmaSettings: vi.fn().mockResolvedValue({ issuer: 'issuer' }),
    } satisfies Partial<OwnerUtil> as any;

    extractor = new UmaTokenExtractor(client, targetExtractor, ownerUtil);
  });

  it('throws an error on a request without Authorization header', async () => {
    const request = {
      method: 'GET',
      headers: { },
    } as any as HttpRequest;
    const result = extractor.handleSafe(request);
    await expect(result).rejects.toThrow(NotImplementedHttpError);
    await expect(result).rejects.toThrow('No Bearer Authorization header specified.');
  });

  it('throws an error on a request without Bearer Authorization header', async () => {
    const request = {
      method: 'GET',
      headers: {'authorization': 'Token 123'},
    } as any as HttpRequest;
    const result = extractor.handleSafe(request);
    await expect(result).rejects.toThrow(NotImplementedHttpError);
    await expect(result).rejects.toThrow('No Bearer Authorization header specified.');
  });

  it('verifies the token on a request with Bearer Authorization header', async () => {
    const request = {
      method: 'GET',
      headers: {
        authorization: 'Bearer 123',
      },
    } as any as HttpRequest;

    await expect(extractor.handleSafe(request)).resolves.toEqual({ uma: { rpt: { verified: true }}});
    expect(client.verifyJwtToken).toHaveBeenCalledTimes(1);
  });

  it('throws an error on a request with Bearer Authorization header and unsupported token', async () => {
    const request = {
      method: 'GET',
      headers: {'authorization': 'Bearer 123'},
    } as any as HttpRequest;

    client.verifyJwtToken.mockRejectedValueOnce(new Error('bad data'));

    const result = extractor.handleSafe(request);
    await expect(result).rejects.toThrow(BadRequestHttpError);
    await expect(result).rejects.toThrow('Error verifying WebID via Bearer access token: bad data');
  });

  describe('with introspection', (): void => {
    const request = {
      method: 'GET',
      headers: {
        authorization: 'Bearer 123',
      },
    } as any as HttpRequest;

    beforeEach(async(): Promise<void> => {
      extractor = new UmaTokenExtractor(client, targetExtractor, ownerUtil, true);
    });

    it('validates the token.', async(): Promise<void> => {
      await expect(extractor.handleSafe(request)).resolves.toEqual({ uma: { rpt: { verified: true }}});
      expect(client.verifyOpaqueToken).toHaveBeenCalledTimes(1);
      expect(client.verifyOpaqueToken).toHaveBeenLastCalledWith('123', 'issuer');
    });

    it('errors if every valid issuer errors.', async(): Promise<void> => {
      client.verifyOpaqueToken.mockRejectedValueOnce(new Error('bad data'));
      await expect(extractor.handleSafe(request)).rejects
        .toThrow('Error verifying WebID via Bearer access token: Introspection failed: bad data');
    });
  });
});
