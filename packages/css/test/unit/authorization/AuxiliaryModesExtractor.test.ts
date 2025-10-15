import {
  AccessMap,
  AuxiliaryStrategy,
  IdentifierSetMultiMap,
  ModesExtractor,
  Operation,
  ResourceIdentifier
} from '@solid/community-server';
import { PERMISSIONS } from '@solidlab/policy-engine';
import { expect, Mocked } from 'vitest';
import { AuxiliaryModesExtractor } from '../../../src/authorization/AuxiliaryModesExtractor';

describe('AuxiliaryModesExtractor', (): void => {
  const input: Operation = { key: 'value' } as any;
  let source: Mocked<ModesExtractor>;
  let strategy: Mocked<AuxiliaryStrategy>;
  let extractor: AuxiliaryModesExtractor;

  beforeEach(async(): Promise<void> => {
    source = {
      canHandle: vi.fn(),
      handle: vi.fn(),
    } satisfies Partial<ModesExtractor> as any;

    strategy = {
      isAuxiliaryIdentifier: vi.fn(),
      usesOwnAuthorization: vi.fn(),
      getSubjectIdentifier: vi.fn(),
    } satisfies Partial<AuxiliaryStrategy> as any;

    extractor = new AuxiliaryModesExtractor(source, strategy);
  });

  it('can handle results the source can handle.', async(): Promise<void> => {
    await expect(extractor.canHandle(input)).resolves.toBeUndefined();
    expect(source.canHandle).toHaveBeenCalledTimes(1);
    expect(source.canHandle).toHaveBeenLastCalledWith(input);

    const error = new Error('bad data');
    source.canHandle.mockRejectedValueOnce(error);
    await expect(extractor.canHandle(input)).rejects.toThrow(error);
    expect(source.canHandle).toHaveBeenCalledTimes(2);
    expect(source.canHandle).toHaveBeenLastCalledWith(input);
  });

  it('replaces auxiliary targets with the subject identifier.', async(): Promise<void> => {
    const results: Record<string, { aux: boolean, own: boolean, subject: string }> = {
      nonAux: { aux: false, own: true, subject: '' },
      own: { aux: true, own: true, subject: '' },
      aux: { aux: true, own: false, subject: 'subject'},
    };
    strategy.isAuxiliaryIdentifier.mockImplementation((id): boolean => results[id.path].aux);
    strategy.usesOwnAuthorization.mockImplementation((id): boolean => results[id.path].own);
    strategy.getSubjectIdentifier.mockImplementation((id): ResourceIdentifier => ({ path: results[id.path].subject }));
    const output: AccessMap = new IdentifierSetMultiMap<string>([
      [ { path: 'nonAux'}, new Set([ PERMISSIONS.Read ]) ],
      [ { path: 'own'}, new Set([ PERMISSIONS.Modify ]) ],
      [ { path: 'aux'}, new Set([ PERMISSIONS.Create ]) ],
    ]);
    source.handle.mockResolvedValueOnce(output);
    const result = await extractor.handle(input);
    expect(result.size).toBe(3);
    expect([ ...result.get({ path: 'nonAux' })!]).toEqual([ PERMISSIONS.Read ]);
    expect([ ...result.get({ path: 'own' })!]).toEqual([ PERMISSIONS.Modify ]);
    expect([ ...result.get({ path: 'subject' })!]).toEqual([ PERMISSIONS.Create ]);
  });
});
