import {InMemoryJwksKeyHolder} from '../secrets/InMemoryJwksKeyHolder';
import {TokenFactory} from './TokenFactory';
import {JwtTokenFactory} from './JwtTokenFactory';
import {decodeJwt, decodeProtectedHeader, generateKeyPair, JWTPayload, KeyLike, SignJWT} from 'jose';
import {BadRequestHttpError} from '../http/errors/BadRequestHttpError';
import {v4} from 'uuid';

const ISSUER = 'https://example.com';
const WEBID = 'https://example.com/profile/alice#me';
const CLIENT = 'https://projectapp.com';
const RESOURCE = 'https://pods.example.com/test/123.ttl';
const ALG = 'ES256';

describe('JWT Access Token Issuance', () => {
  const keyholder = new InMemoryJwksKeyHolder(ALG);
  const tokenFactory: TokenFactory = new JwtTokenFactory(keyholder, ISSUER);

  test('Should yield JWT for access token', async () => {
    // const accessToken = await tokenFactory.serialize({webId: WEBID, clientId: CLIENT, sub: {iri: RESOURCE}, modes: new Set(['read', 'write'])});
    const accessToken = await tokenFactory.serialize({
      webId: WEBID,
      clientId: CLIENT,
      permissions: [{
        resource_id: RESOURCE,
        resource_scopes: ['read', 'write'],
      }],
    });

    expect(accessToken.token).toBeTruthy();
    expect(decodeProtectedHeader(accessToken.token)).toEqual({alg: ALG, kid: await keyholder.getDefaultKey()});
    const payload = decodeJwt(accessToken.token);

    expect(payload).toBeTruthy();
    // expect('sub' in payload).toBeTruthy();
    expect('aud' in payload).toBeTruthy();
    expect('permissions' in payload).toBeTruthy();
    expect('webid' in payload).toBeTruthy();
    expect('azp' in payload).toBeTruthy();
    expect('iss' in payload).toBeTruthy();
    expect('jti' in payload).toBeTruthy();

    expect(payload.iss).toEqual(ISSUER);
    expect(payload.aud).toEqual('solid');

    expect(payload.modes).toEqual(['http://www.w3.org/ns/auth/acl#Read', 'http://www.w3.org/ns/auth/acl#Write']);
    expect(payload.webid).toEqual(WEBID);
    expect(payload.azp).toEqual(CLIENT);
    expect(payload.sub).toEqual(RESOURCE);
  });
});

describe('Deserialization tests', () => {
  const keyholder = new InMemoryJwksKeyHolder(ALG);
  const tokenFactory: TokenFactory = new JwtTokenFactory(keyholder, ISSUER);

  test('E2E', async () => {
    const accessToken = {
      webId: WEBID,
      clientId: CLIENT,
      permissions: [{
        resource_id: RESOURCE,
        resource_scopes: ['read', 'write', 'create', 'append', 'delete'],
      }],
    };
    const jwt = (await tokenFactory.serialize(accessToken)).token;

    expect(await tokenFactory.deserialize(jwt)).toEqual(accessToken);
  });

  test('Invalid JWT should throw error', async () => {
    expect(async () => await tokenFactory.deserialize('abc')).rejects.toThrow(BadRequestHttpError);
  });

  test('Invalid Signature should throw error', async () => {
    const key = await generateKeyPair(ALG);
    const jwt = await createJwt({}, key.privateKey);

    expect(async () => await tokenFactory.deserialize(jwt)).rejects.toThrow(BadRequestHttpError);
    expect(async () => await tokenFactory.deserialize(jwt)).rejects
        .toThrow('Invalid Access Token provided, error while parsing: signature verification failed');
  });

  test('Missing payload claim `webid` should throw error', async () => {
    const jwt = await createJwt({azp: CLIENT, sub: RESOURCE, aud: 'solid',
      modes: new Set(['read', 'write', 'create', 'append', 'delete'])},
    keyholder.getPrivateKey(await keyholder.getDefaultKey()));

    expect(async () => await tokenFactory.deserialize(jwt)).rejects.toThrow(BadRequestHttpError);
    expect(async () => await tokenFactory.deserialize(jwt)).rejects
        .toThrow('Invalid Access Token provided, error while parsing:' +
        ' Missing JWT parameter(s): {sub, aud, modes, webid, azp} are required.');
  });

  test('Missing payload claim `azp` should throw error', async () => {
    const jwt = await createJwt({webid: WEBID, sub: RESOURCE, aud: 'solid',
      modes: new Set(['read', 'write', 'create', 'append', 'delete'])},
    keyholder.getPrivateKey(await keyholder.getDefaultKey()));

    expect(async () => await tokenFactory.deserialize(jwt)).rejects.toThrow(BadRequestHttpError);
    expect(async () => await tokenFactory.deserialize(jwt)).rejects
        .toThrow('Invalid Access Token provided, error while parsing:' +
        ' Missing JWT parameter(s): {sub, aud, modes, webid, azp} are required.');
  });

  test('Missing payload claim `sub` should throw error', async () => {
    const jwt = await createJwt({webid: WEBID, azp: CLIENT, aud: 'solid',
      modes: new Set(['read', 'write', 'create', 'append', 'delete'])},
    keyholder.getPrivateKey(await keyholder.getDefaultKey()));

    expect(async () => await tokenFactory.deserialize(jwt)).rejects.toThrow(BadRequestHttpError);
    expect(async () => await tokenFactory.deserialize(jwt)).rejects
        .toThrow('Invalid Access Token provided, error while parsing:' +
        ' Missing JWT parameter(s): {sub, aud, modes, webid, azp} are required.');
  });

  test('Missing payload claim `aud` should throw error', async () => {
    const jwt = await createJwt({webid: WEBID, azp: CLIENT, sub: RESOURCE,
      modes: new Set(['read', 'write', 'create', 'append', 'delete'])},
    keyholder.getPrivateKey(await keyholder.getDefaultKey()));

    expect(async () => await tokenFactory.deserialize(jwt)).rejects.toThrow(BadRequestHttpError);
    expect(async () => await tokenFactory.deserialize(jwt)).rejects
        .toThrow('Invalid Access Token provided, error while parsing:' +
        ' unexpected \"aud\" claim value');
  });

  test('Missing payload claim `modes` should throw error', async () => {
    const jwt = await createJwt({webid: WEBID, azp: CLIENT, sub: RESOURCE, aud: 'solid'},
        keyholder.getPrivateKey(await keyholder.getDefaultKey()));

    expect(async () => await tokenFactory.deserialize(jwt)).rejects.toThrow(BadRequestHttpError);
    expect(async () => await tokenFactory.deserialize(jwt)).rejects
        .toThrow('Invalid Access Token provided, error while parsing:' +
        ' Missing JWT parameter(s): {sub, aud, modes, webid, azp} are required.');
  });

  test('Non-string claim `webid` should throw error', async () => {
    const jwt = await createJwt({webid: 123, azp: CLIENT, sub: RESOURCE, aud: 'solid',
      modes: new Set(['read', 'write', 'create', 'append', 'delete'])},
    keyholder.getPrivateKey(await keyholder.getDefaultKey()));
    expect(async () => await tokenFactory.deserialize(jwt)).rejects.toThrow(BadRequestHttpError);
    expect(async () => await tokenFactory.deserialize(jwt)).rejects
        .toThrow('Invalid Access Token provided, error while parsing:' +
        ' JWT claim "webid" is not a string.');
  });
  test('Non-array claim `modes` should throw error', async () => {
    const jwt = await createJwt({webid: WEBID, azp: CLIENT, sub: RESOURCE, aud: 'solid',
      modes: 123},
    keyholder.getPrivateKey(await keyholder.getDefaultKey()));
    expect(async () => await tokenFactory.deserialize(jwt)).rejects
        .toThrow('Invalid Access Token provided, error while parsing:' +
        ' JWT claim "modes" is not an array.');
  });

  test('Non-string claim `azp` should throw error', async () => {
    const jwt = await createJwt({webid: WEBID, azp: 123, sub: RESOURCE, aud: 'solid',
      modes: new Set(['read', 'write', 'create', 'append', 'delete'])},
    keyholder.getPrivateKey(await keyholder.getDefaultKey()));
    expect(async () => await tokenFactory.deserialize(jwt)).rejects.toThrow(BadRequestHttpError);
    expect(async () => await tokenFactory.deserialize(jwt)).rejects
        .toThrow('Invalid Access Token provided, error while parsing:' +
        ' JWT claim "azp" is not a string.');
  });
});

describe('Test anonymous client', () => {
  const keyholder = new InMemoryJwksKeyHolder(ALG);
  const tokenFactory: TokenFactory = new JwtTokenFactory(keyholder, ISSUER);

  test('Should yield JWT for access token', async () => {
    const accessToken = await tokenFactory.serialize({
      webId: WEBID,
      clientId: CLIENT,
      permissions: [{
        resource_id: RESOURCE,
        resource_scopes: ['read', 'write'],
      }],
    });

    expect(accessToken.token).toBeTruthy();
    expect(decodeProtectedHeader(accessToken.token)).toEqual({alg: ALG, kid: await keyholder.getDefaultKey()});
    const payload = decodeJwt(accessToken.token);

    expect(payload).toBeTruthy();
    expect('sub' in payload).toBeTruthy();
    expect('aud' in payload).toBeTruthy();
    expect('modes' in payload).toBeTruthy();
    expect('webid' in payload).toBeTruthy();
    expect('azp' in payload).toBeTruthy();
    expect('iss' in payload).toBeTruthy();
    expect('jti' in payload).toBeTruthy();

    expect(payload.iss).toEqual(ISSUER);
    expect(payload.aud).toEqual('solid');

    expect(payload.modes).toEqual(['http://www.w3.org/ns/auth/acl#Read', 'http://www.w3.org/ns/auth/acl#Write']);
    expect(payload.webid).toEqual(WEBID);
    expect(payload.azp).toEqual('http://www.w3.org/ns/auth/acl#Origin');
    expect(payload.sub).toEqual(RESOURCE);
  });
});

const createJwt = async (payload: JWTPayload, key: KeyLike, issuer: string = ISSUER) => {
  return new SignJWT(payload)
      .setProtectedHeader({alg: ALG})
      .setIssuedAt()
      .setIssuer(issuer)
      .setExpirationTime('30m')
      .setJti(v4())
      .sign(key);
};


