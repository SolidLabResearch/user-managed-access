import { Mocked } from 'vitest';
import { PatUpdateHandler } from '../../../../src/identity/interaction/PatUpdateHandler';
import { PatUpdater } from '../../../../src/identity/PatUpdater';

describe('PatUpdateHandler', (): void => {
  let updater: Mocked<PatUpdater>;
  let handler: PatUpdateHandler;

  beforeEach(async(): Promise<void> => {
    updater = {
      updateSettings: vi.fn(),
    } satisfies Partial<PatUpdater> as any;

    handler = new PatUpdateHandler(updater);
  });

  it('can return the input view.', async(): Promise<void> => {
    await expect(handler.getView({} as any)).resolves.toEqual({
      json: {
        fields: {
          id: { required: true, type: 'string' },
          issuer: { required: true, type: 'string' },
          secret: { required: true, type: 'string' },
        }
      }
    });
  });

  it('can call the updater with the new settings.', async(): Promise<void> => {
    const json = {
      id: 'id',
      issuer: 'issuer',
      secret: 'secret',
    };
    await expect(handler.handle({ accountId: 'accountId', json } as any)).resolves.toEqual({ json: {}});
    expect(updater.updateSettings).toHaveBeenCalledTimes(1);
    expect(updater.updateSettings).toHaveBeenLastCalledWith('accountId', 'id', 'secret', 'issuer');
  });
});
