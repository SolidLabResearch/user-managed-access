import {InMemoryJwksKeyHolder} from './InMemoryJwksKeyHolder';

describe('Testing errors on holder', () => {
  const keyholder = new InMemoryJwksKeyHolder('ES256');
  test('holder should throw error when retrieving unkown private key', () => {
    expect(() => keyholder.getPrivateKey('abc'))
        .toThrowError('The specified kid \'abc\' does not exist in the holder.');
  });
  test('holder should throw error when retrieving unkown public key', () => {
    expect(() => keyholder.getPublicKey('abc'))
        .toThrowError('The specified kid \'abc\' does not exist in the holder.');
  });
  test('holder should throw error when retrieving unkown JWK', async () => {
    expect.assertions(1);
    try {
      await keyholder.toPublicJwk('abc');
    } catch (e:any) {
      expect(e.message).toEqual('The specified kid \'abc\' does not exist in the holder.');
    }
  });
});

describe('Validity of constructor arguments', () => {
  test('Unsupported algorithm should throw error', () => {
    expect(() => new InMemoryJwksKeyHolder('abc'))
        .toThrowError('The chosen algorithm \'abc\' is not supported by the InMemoryJwksKeyHolder.');
  });
});


describe('Testing operations on filled holder.', () => {
  const keyholder = new InMemoryJwksKeyHolder('ES256');
  let kid:string;
  test('Keyholder should return algorithm', () => {
    expect(keyholder.getAlg()).toEqual('ES256');
  });
  test('Holder should return default kid upon creation', async () => {
    kid = await keyholder.getDefaultKey();
    expect(kid).toBeTruthy();
  });
  test('Holder should have one key ID', async () => {
    expect(keyholder.getKids()).toStrictEqual([kid]);
  });
  test('Holder should have a default key', async () => {
    expect(await keyholder.getDefaultKey()).toStrictEqual(kid);
  });
  test('Holder should have one key in JWKS', async () => {
    expect((await keyholder.getJwks()).keys.length).toStrictEqual(1);
  });
  test('Holder should have public key', async () => {
    expect(keyholder.getPublicKey(kid)).toBeTruthy();
  });
  test('Holder should have private key', async () => {
    expect(keyholder.getPrivateKey(kid)).toBeTruthy();
  });
});
