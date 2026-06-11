import { AlgJwk, JwkGenerator } from '@solid/community-server';
import { exportJWK, generateKeyPair, importJWK, SignJWT } from 'jose';
import { Mocked } from 'vitest';
import { HttpHandlerRequest } from '../../../../../src/util/http/models/HttpHandler';
import {
  DerivationManagementTokenValidator
} from '../../../../../src/util/http/validate/DerivationManagementTokenValidator';

describe('DerivationManagementTokenValidator', (): void => {
  const baseUrl = 'http://example.com/uma';
  const alg = 'ES256';
  let publicKey: AlgJwk;
  let privateKey: AlgJwk;
  let keyGen: Mocked<JwkGenerator>;
  let request: HttpHandlerRequest;
  let validator: DerivationManagementTokenValidator;

  beforeAll(async(): Promise<void> => {
    const keys = await generateKeyPair(alg);
    publicKey = { ...await exportJWK(keys.publicKey), alg };
    privateKey = { ...await exportJWK(keys.privateKey), alg };
  });

  beforeEach(async(): Promise<void> => {
    keyGen = {
      getPublicKey: vi.fn().mockResolvedValue(publicKey),
    } as any;
    request = {
      url: new URL('http://example.com/uma/resources/handle-id-1'),
      parameters: { id: 'handle-id-1' },
      headers: {},
      method: 'PUT',
    };
    validator = new DerivationManagementTokenValidator(keyGen, baseUrl);
    request.headers.authorization = `Bearer ${await signManagementToken('handle-id-1')}`;
  });

  it('returns authorization bound to the derivation resource.', async(): Promise<void> => {
    await expect(validator.handle({ request })).resolves.toEqual({
      owner: 'aggregator-client',
      resourceServer: 'aggregator-client',
      resourceId: 'handle-id-1',
      allowCreate: true,
    });
  });

  it('rejects tokens for a different derivation resource.', async(): Promise<void> => {
    request.parameters = { id: 'other-id' };
    await expect(validator.handle({ request })).rejects
      .toThrow('Management token is not valid for this derivation resource.');
  });

  async function signManagementToken(resourceId: string): Promise<string> {
    const jwk = await importJWK(privateKey, privateKey.alg);
    return new SignJWT({
      scope: 'urn:knows:uma:scopes:derivation-management',
      derivation_resource_id: resourceId,
      client_id: 'aggregator-client',
    }).setProtectedHeader({ alg: privateKey.alg!, kid: privateKey.kid })
      .setSubject('aggregator-client')
      .setIssuer(baseUrl)
      .setAudience(baseUrl)
      .setExpirationTime('30m')
      .sign(jwk);
  }
});
