import { AlgJwk, JwkGenerator, KeyValueStorage } from '@solid/community-server';
import { exportJWK, generateKeyPair, GenerateKeyPairResult, jwtVerify, KeyLike, SignJWT } from 'jose';
import { beforeAll, Mocked } from 'vitest';
import { AccessToken } from '../../../src/tokens/AccessToken';
import { JwtTokenFactory } from '../../../src/tokens/JwtTokenFactory';

const now = new Date();
vi.useFakeTimers({ now });

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn().mockReturnValue('1-2-3-4-5'),
}));

describe('JwtTokenFactory', (): void => {
  const alg = 'ES256';
  const issuer = 'https://example.com/';
  let keys: GenerateKeyPairResult;
  let publicKey: AlgJwk;
  let privateKey: AlgJwk;

  const token: AccessToken = {
    permissions: [ { resource_id: 'id', resource_scopes: [ 'scopes' ]} ],
    contract: {
      uid: 'uid',
      permission: [{
        action: 'urn:example:css:modes:action',
        target: 'target',
        assigner: 'assigner',
        assignee: 'assignee',
      }],
    },
  };

  let keyGen: Mocked<JwkGenerator>;
  let tokenStore: Mocked<KeyValueStorage<string, AccessToken>>;
  let factory: JwtTokenFactory;

  beforeAll(async(): Promise<void> => {
    keys = await generateKeyPair(alg);
    publicKey = { ...await exportJWK(keys.publicKey), alg };
    privateKey = { ...await exportJWK(keys.privateKey), alg };
  });

  beforeEach(async(): Promise<void> => {
    keyGen = {
      alg: alg,
      getPublicKey: vi.fn().mockResolvedValue(publicKey),
      getPrivateKey: vi.fn().mockResolvedValue(privateKey),
    };

    tokenStore = {
      set: vi.fn(),
    } satisfies Partial<KeyValueStorage<string, AccessToken>> as any;

    factory = new JwtTokenFactory(keyGen, issuer, tokenStore);
  });

  it('serializes an access token to a JWT.', async(): Promise<void> => {
    const result = await factory.serialize(token);
    expect(result.tokenType).toBe('Bearer');
    const parsed = await jwtVerify(result.token, keys.publicKey);
    expect(parsed.payload).toEqual({
      ...token,
      iat: Math.floor(now.getTime()/1000),
      iss: issuer,
      aud: 'solid',
      exp: Math.floor(now.getTime()/1000) + 30 * 60,
      jti: '1-2-3-4-5',
    });
    expect(parsed.protectedHeader.alg).toBe(alg);
    expect(parsed.protectedHeader.kid).toBe(privateKey.kid);
    expect(tokenStore.set).toHaveBeenCalledTimes(1);
    expect(tokenStore.set).toHaveBeenLastCalledWith(result.token, token);
  });

  it('returns the permissions of the deserialized token.', async(): Promise<void> => {
    const jwt = await new SignJWT(token)
      .setProtectedHeader({ alg: privateKey.alg, kid: privateKey.kid })
      .setIssuer(issuer)
      .setAudience('solid')
      .sign(keys.privateKey);
    await expect(factory.deserialize(jwt)).resolves.toEqual({ permissions: token.permissions });
  });

  it('errors deserializing tokens with no aud field.', async(): Promise<void> => {
    const jwt = await new SignJWT(token)
      .setProtectedHeader({ alg: privateKey.alg, kid: privateKey.kid })
      .setIssuer(issuer)
      .sign(keys.privateKey);
    await expect(factory.deserialize(jwt)).rejects
      .toThrow('Invalid Access Token provided, error while parsing: missing required "aud" claim');
  });

  it('errors deserializing tokens with no permissions.', async(): Promise<void> => {
    const jwt = await new SignJWT({})
      .setProtectedHeader({ alg: privateKey.alg, kid: privateKey.kid })
      .setIssuer(issuer)
      .setAudience('solid')
      .sign(keys.privateKey);
    await expect(factory.deserialize(jwt)).rejects
      .toThrow('Invalid Access Token provided, error while parsing: missing required "permissions" claim');
  });

  it('errors deserializing if permissions have the wrong format.', async(): Promise<void> => {
    const jwt = await new SignJWT({ permissions: 'apple' })
      .setProtectedHeader({ alg: privateKey.alg, kid: privateKey.kid })
      .setIssuer(issuer)
      .setAudience('solid')
      .sign(keys.privateKey);
    await expect(factory.deserialize(jwt)).rejects
      .toThrow('Invalid Access Token provided, error while parsing: value is not an array');
  });
});
