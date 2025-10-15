import {
  AccessMap,
  Authorizer,
  ForbiddenHttpError, HttpError,
  IdentifierSetMultiMap,
  InternalServerError
} from '@solid/community-server';
import { PERMISSIONS } from '@solidlab/policy-engine';
import { Mocked } from 'vitest';
import { UmaAuthorizer, WWW_AUTH } from '../../../src/authorization/UmaAuthorizer';
import { UmaClient } from '../../../src/uma/UmaClient';
import { OwnerUtil } from '../../../src/util/OwnerUtil';

describe('UmaAuthorizer', (): void => {
  let source: Mocked<Authorizer>;
  let ownerUtil: Mocked<OwnerUtil>;
  let client: Mocked<UmaClient>;
  let authorizer: UmaAuthorizer;

  beforeEach(async(): Promise<void> => {
    source = {
      handleSafe: vi.fn(),
    } satisfies Partial<Authorizer> as any;

    ownerUtil = {
      findCommonOwner: vi.fn(),
      findIssuer: vi.fn(),
    } satisfies Partial<OwnerUtil> as any;

    client = {
      fetchTicket: vi.fn(),
    } satisfies Partial<UmaClient> as any;

    authorizer = new UmaAuthorizer(source, ownerUtil, client);
  });

  it('does nothing extra if no error is thrown.', async(): Promise<void> => {
    const input = { key: 'value' };

    await expect(authorizer.handle(input as any)).resolves.toBeUndefined();
    expect(source.handleSafe).toHaveBeenCalledTimes(1);
    expect(source.handleSafe).toHaveBeenLastCalledWith(input);
    expect(ownerUtil.findCommonOwner).toHaveBeenCalledTimes(0);
    expect(ownerUtil.findIssuer).toHaveBeenCalledTimes(0);
    expect(client.fetchTicket).toHaveBeenCalledTimes(0);
  });

  it('re-throws the error if it was not a 401/403.', async(): Promise<void> => {
    const error = new InternalServerError('bad data');
    source.handleSafe.mockRejectedValueOnce(error);

    await expect(authorizer.handle({ key: 'value' } as any)).rejects.toThrowError(error);
    expect(ownerUtil.findCommonOwner).toHaveBeenCalledTimes(0);
    expect(ownerUtil.findIssuer).toHaveBeenCalledTimes(0);
    expect(client.fetchTicket).toHaveBeenCalledTimes(0);
  });

  it('errors if no issuer could be found.', async(): Promise<void> => {
    source.handleSafe.mockRejectedValueOnce(new ForbiddenHttpError());
    ownerUtil.findCommonOwner.mockResolvedValueOnce('owner');
    const requestedModes: AccessMap = new IdentifierSetMultiMap<string>([[ { path: 'id' }, PERMISSIONS.Read ]]);

    await expect(authorizer.handle({ requestedModes } as any)).rejects
      .toThrowError(`No UMA authorization server found for owner.`);
    expect(ownerUtil.findCommonOwner).toHaveBeenCalledTimes(1);
    expect(ownerUtil.findIssuer).toHaveBeenCalledTimes(1);
    expect(client.fetchTicket).toHaveBeenCalledTimes(0);
  });

  it('adds the found ticket to the error.', async(): Promise<void> => {
    source.handleSafe.mockRejectedValueOnce(new ForbiddenHttpError());
    ownerUtil.findCommonOwner.mockResolvedValueOnce('owner');
    ownerUtil.findIssuer.mockResolvedValueOnce('issuer');
    client.fetchTicket.mockResolvedValueOnce('ticket');
    const requestedModes: AccessMap = new IdentifierSetMultiMap<string>([[ { path: 'id' }, PERMISSIONS.Read ]]);

    try {
      await authorizer.handle({ requestedModes } as any);
      expect(false).toBe(true);
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenHttpError)
      expect((err as HttpError).metadata.get(WWW_AUTH)?.value)
        .toBe(`UMA realm="solid", as_uri="issuer", ticket="ticket"`);
    }
  });

  it('resolves if no ticket was received.', async(): Promise<void> => {
    source.handleSafe.mockRejectedValueOnce(new ForbiddenHttpError());
    ownerUtil.findCommonOwner.mockResolvedValueOnce('owner');
    ownerUtil.findIssuer.mockResolvedValueOnce('issuer');
    const requestedModes: AccessMap = new IdentifierSetMultiMap<string>([[ { path: 'id' }, PERMISSIONS.Read ]]);

    await expect(authorizer.handle({ requestedModes } as any)).resolves.toBeUndefined();
  });

  it('throws an error if there was an issue fetching the ticket.', async(): Promise<void> => {
    source.handleSafe.mockRejectedValueOnce(new ForbiddenHttpError());
    ownerUtil.findCommonOwner.mockResolvedValueOnce('owner');
    ownerUtil.findIssuer.mockResolvedValueOnce('issuer');
    client.fetchTicket.mockRejectedValueOnce(new Error('bad data'));
    const requestedModes: AccessMap = new IdentifierSetMultiMap<string>([[ { path: 'id' }, PERMISSIONS.Read ]]);

    await expect(authorizer.handle({ requestedModes } as any)).rejects
      .toThrow(`Error while requesting UMA header: bad data.`);
  });
});
