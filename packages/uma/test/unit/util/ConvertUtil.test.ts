import { isPrimitive, formToJson, jsonToForm } from '../../../src/util/ConvertUtil';

describe('ConvertUtil', (): void => {
  describe('#formToJson', (): void => {
    it('converts a form encoded string to JSON.', async(): Promise<void> => {
      expect(formToJson('a=b&c=sp%20ace&d=1&d=2')).toEqual({
        a: 'b',
        c: 'sp ace',
        d: [ '1', '2' ],
      });
    });
  });

  describe('#jsonToForm', (): void => {
    it('converts a JSON object to a form encoded string.', async(): Promise<void> => {
      expect(jsonToForm({ a: 'b', c: 'sp ace', d: [ 1, 2 ] })).toEqual('a=b&c=sp%20ace&d=1&d=2');
    });

    it('errors for non-primitive values.', async(): Promise<void> => {
      expect(() => jsonToForm({ a: { b: 'c' }}))
        .toThrow('Can only convert JSON objects with primitives or arrays of primitives to urlencoded string.');
      expect(() => jsonToForm({ a: [{ b: 'c' }]}))
        .toThrow('Can only convert JSON objects with primitives or arrays of primitives to urlencoded string.');
    });
  });

  describe('#isPrimitive', (): void => {
    it('returns true for strings, numbers, and booleans.', async(): Promise<void> => {
      expect(isPrimitive(5)).toBe(true);
      expect(isPrimitive(false)).toBe(true);
      expect(isPrimitive('apple')).toBe(true);
      expect(isPrimitive([])).toBe(false);
      expect(isPrimitive({})).toBe(false);
    });
  });
});
