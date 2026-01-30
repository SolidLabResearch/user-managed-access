import { decodeAggregateId, encodeAggregateId } from '../../../src/util/AggregatorUtil';

describe('AggregatorUtil', (): void => {
  it('can encode and decode identifiers.', async(): Promise<void> => {
    const identifier = 'identifier';
    const encoded = await encodeAggregateId(identifier);
    await expect(decodeAggregateId(encoded)).resolves.toBe(identifier);
  });
});
