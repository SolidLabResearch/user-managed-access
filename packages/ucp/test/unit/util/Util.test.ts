import 'jest-rdf';
import { DataFactory as DF, Store } from 'n3';
import { extractQuadsRecursive } from '../../../src/util/Util';

describe('Util', (): void => {
  describe('#extractQuadsRecursive', (): void => {
    it('only adds linked quads.', async(): Promise<void> => {
      const quads = [
        DF.quad(DF.namedNode('urn:a'), DF.namedNode('urn:b'), DF.namedNode('urn:c')),
        DF.quad(DF.namedNode('urn:a'), DF.namedNode('urn:d'), DF.namedNode('urn:e')),
        DF.quad(DF.namedNode('urn:c'), DF.namedNode('urn:f'), DF.namedNode('urn:g')),
        DF.quad(DF.namedNode('urn:h'), DF.namedNode('urn:i'), DF.namedNode('urn:j')),
      ];

      expect(extractQuadsRecursive(new Store(quads), 'urn:a')).toBeRdfIsomorphic([
        DF.quad(DF.namedNode('urn:a'), DF.namedNode('urn:b'), DF.namedNode('urn:c')),
        DF.quad(DF.namedNode('urn:a'), DF.namedNode('urn:d'), DF.namedNode('urn:e')),
        DF.quad(DF.namedNode('urn:c'), DF.namedNode('urn:f'), DF.namedNode('urn:g')),
      ]);
    });

    it('does not get stuck in infinite loops.', async(): Promise<void> => {
      const quads = [
        DF.quad(DF.namedNode('urn:a'), DF.namedNode('urn:b'), DF.namedNode('urn:c')),
        DF.quad(DF.namedNode('urn:c'), DF.namedNode('urn:d'), DF.namedNode('urn:e')),
        DF.quad(DF.namedNode('urn:e'), DF.namedNode('urn:f'), DF.namedNode('urn:c')),
      ];

      expect(extractQuadsRecursive(new Store(quads), 'urn:a')).toBeRdfIsomorphic([
        DF.quad(DF.namedNode('urn:a'), DF.namedNode('urn:b'), DF.namedNode('urn:c')),
        DF.quad(DF.namedNode('urn:c'), DF.namedNode('urn:d'), DF.namedNode('urn:e')),
        DF.quad(DF.namedNode('urn:e'), DF.namedNode('urn:f'), DF.namedNode('urn:c')),
      ]);
    });
  });
});
