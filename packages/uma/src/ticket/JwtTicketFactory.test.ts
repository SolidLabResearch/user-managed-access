import {InMemoryJwksKeyHolder} from '../secrets/InMemoryJwksKeyHolder';
import {JwtTicketFactory} from './JwtTicketFactory';
import {TicketFactory} from './TicketFactory';
import {decodeJwt, decodeProtectedHeader, generateKeyPair, JWTPayload, KeyLike, SignJWT} from 'jose';
import {v4} from 'uuid';
import {InvalidGrantError} from '../error/InvalidGrantError';

const ISSUER = 'https://example.com';
const RESOURCE = 'https://pods.example.com/test/123.ttl';
const OWNER = 'https://pods.example.com/alice/profile/card#me';

describe('Serialization tests', () => {
  const keyholder = new InMemoryJwksKeyHolder('ES256');
  const ticketFactory: TicketFactory = new JwtTicketFactory(keyholder, ISSUER);

  test('Should yield JWT for ticket', async () => {
    const jwt = await ticketFactory.serialize([{
      resource_id: RESOURCE,
      resource_scopes: ['read', 'write'],
    }]);

    expect(jwt).toBeTruthy();
    expect(decodeProtectedHeader(jwt)).toEqual({alg: 'ES256', kid: await keyholder.getDefaultKey()});
    const payload = decodeJwt(jwt);

    expect(payload).toBeTruthy();
    expect('sub' in payload).toBeTruthy();
    expect('aud' in payload).toBeTruthy();
    expect('modes' in payload).toBeTruthy();
    expect('iss' in payload).toBeTruthy();
    expect('owner' in payload).toBeTruthy();
    expect('jti' in payload).toBeTruthy();

    expect(payload.iss).toEqual(ISSUER);
    expect(payload.aud).toEqual('solid');

    expect(payload.modes).toEqual(['http://www.w3.org/ns/auth/acl#Read', 'http://www.w3.org/ns/auth/acl#Write']);
    expect(payload.owner).toEqual(OWNER);
    expect(payload.sub).toEqual(RESOURCE);
  });
});

describe('Deserialization tests', () => {
  const keyholder = new InMemoryJwksKeyHolder('ES256');
  const ticketFactory: TicketFactory = new JwtTicketFactory(keyholder, ISSUER);

  test('E2E', async () => {
    const ticket = [{
      resource_id: RESOURCE,
      resource_scopes: ['read', 'write', 'create', 'append', 'delete'],
    }];
    const jwt = await ticketFactory.serialize(ticket);

    expect(await ticketFactory.deserialize(jwt)).toEqual(ticket);
  });

  test('Invalid JWT should throw error', async () => {
    expect(async () => await ticketFactory.deserialize('abc')).rejects.toThrow(InvalidGrantError);
  });

  test('Invalid Signature should throw error', async () => {
    const key = await generateKeyPair('ES256');
    const jwt = await createJwt({owner: OWNER, sub: RESOURCE, modes: ['read']}, key.privateKey);

    expect(async () => await ticketFactory.deserialize(jwt)).rejects.toThrow(InvalidGrantError);
    expect(async () => await ticketFactory.deserialize(jwt)).rejects
        .toThrow('Invalid UMA Ticket provided, error while parsing: signature verification failed');
  });

  test('Missing payload claim `owner` should throw error', async () => {
    const jwt = await createJwt({sub: RESOURCE, modes: ['read'], aud: 'solid'},
        keyholder.getPrivateKey(await keyholder.getDefaultKey()));
    expect(async () => await ticketFactory.deserialize(jwt)).rejects.toThrow(InvalidGrantError);
    expect(async () => await ticketFactory.deserialize(jwt)).rejects
        .toThrow('Invalid UMA Ticket provided, error while parsing:' +
        ' Missing JWT parameter(s): {sub, aud, modes, owner} are required.');
  });

  test('Missing payload claim `sub` should throw error', async () => {
    const jwt = await createJwt({owner: OWNER, modes: ['read'], aud: 'solid'},
        keyholder.getPrivateKey(await keyholder.getDefaultKey()));

    expect(async () => await ticketFactory.deserialize(jwt)).rejects.toThrow(InvalidGrantError);
    expect(async () => await ticketFactory.deserialize(jwt)).rejects
        .toThrow('Invalid UMA Ticket provided, error while parsing:' +
        ' Missing JWT parameter(s): {sub, aud, modes, owner} are required.');
  });

  test('Missing payload claim `modes` should throw error', async () => {
    const jwt = await createJwt({owner: OWNER, sub: RESOURCE, aud: 'solid'},
        keyholder.getPrivateKey(await keyholder.getDefaultKey()));

    expect(async () => await ticketFactory.deserialize(jwt)).rejects.toThrow(InvalidGrantError);
    expect(async () => await ticketFactory.deserialize(jwt)).rejects
        .toThrow('Invalid UMA Ticket provided, error while parsing:' +
        ' Missing JWT parameter(s): {sub, aud, modes, owner} are required.');
  });

  test('Missing payload claim `aud` should throw error', async () => {
    const jwt = await createJwt({owner: OWNER, sub: RESOURCE, modes: ['read']},
        keyholder.getPrivateKey(await keyholder.getDefaultKey()));
    expect(async () => await ticketFactory.deserialize(jwt)).rejects.toThrow(InvalidGrantError);
    expect(async () => await ticketFactory.deserialize(jwt)).rejects
        .toThrow('Invalid UMA Ticket provided, error while parsing:' +
        ' unexpected \"aud\" claim value');
  });

  test('Non-string payload claim `owner` should throw error', async () => {
    const jwt = await createJwt({owner: 123, sub: 'test/123.ttl', modes: ['read'], aud: 'solid'},
        keyholder.getPrivateKey(await keyholder.getDefaultKey()));
    expect(async () => await ticketFactory.deserialize(jwt)).rejects.toThrow(InvalidGrantError);
    expect(async () => await ticketFactory.deserialize(jwt)).rejects
        .toThrow('Invalid UMA Ticket provided, error while parsing:' +
        ' JWT claim "owner" is not a string.');
  });

  test('Non-array payload claim `modes` should throw error', async () => {
    const jwt = await createJwt({owner: OWNER, sub: 'test/123.ttl', modes: 123, aud: 'solid'},
        keyholder.getPrivateKey(await keyholder.getDefaultKey()));
    expect(async () => await ticketFactory.deserialize(jwt)).rejects.toThrow(InvalidGrantError);
    expect(async () => await ticketFactory.deserialize(jwt)).rejects
        .toThrow('Invalid UMA Ticket provided, error while parsing:' +
        ' JWT claim "modes" is not an array.');
  });

  test('Invalid mode in claim `modes` should throw error', async () => {
    const jwt = await createJwt({owner: OWNER, sub: 'test/123.ttl', modes: ['read', 'abc'], aud: 'solid'},
        keyholder.getPrivateKey(await keyholder.getDefaultKey()));
    expect(async () => await ticketFactory.deserialize(jwt)).rejects.toThrow(InvalidGrantError);
    expect(async () => await ticketFactory.deserialize(jwt)).rejects
        .toThrow('Invalid UMA Ticket provided, error while parsing:' +
        ' Invalid access mode: abc.');
  });

  test('Invalid mode in claim `modes` should throw error', async () => {
    const jwt = await createJwt({owner: OWNER, sub: 'test/123.ttl', modes: ['read', 123], aud: 'solid'},
        keyholder.getPrivateKey(await keyholder.getDefaultKey()));
    expect(async () => await ticketFactory.deserialize(jwt)).rejects.toThrow(InvalidGrantError);
    expect(async () => await ticketFactory.deserialize(jwt)).rejects
        .toThrow('Invalid UMA Ticket provided, error while parsing:' +
        ' Invalid access mode: 123');
  });
});

const createJwt = async (payload: JWTPayload, key: KeyLike, issuer: string = ISSUER) => {
  return await new SignJWT(payload)
      .setProtectedHeader({alg: 'ES256'})
      .setIssuedAt()
      .setIssuer(issuer)
      .setExpirationTime('30m')
      .setJti(v4())
      .sign(key);
};
