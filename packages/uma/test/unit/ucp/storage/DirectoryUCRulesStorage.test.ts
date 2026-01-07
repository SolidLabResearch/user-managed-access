import 'jest-rdf';
import { RDF } from '@solid/community-server';
import { DataFactory as DF, Store } from 'n3';
import * as fs from 'node:fs';
import path from 'node:path';
import { DirectoryUCRulesStorage } from '../../../../src/ucp/storage/DirectoryUCRulesStorage';

vi.mock('fs', () => ({
  lstatSync: vi.fn().mockReturnValue({ isDirectory: vi.fn().mockReturnValue(true) }),
  promises: {
    readdir: vi.fn(),
    readFile: vi.fn(),
  },
}));

describe('DirectoryUCRulesStorage', (): void => {
  const directoryPath = '/foo/bar';
  const baseIRI = 'http://example.com/';
  const readdirMock = vi.spyOn(fs.promises, 'readdir');
  const readFileMock = vi.spyOn(fs.promises, 'readFile');
  let storage: DirectoryUCRulesStorage;

  beforeEach(async(): Promise<void> => {
    vi.clearAllMocks();
    storage = new DirectoryUCRulesStorage(directoryPath, baseIRI);
  });

  describe('.getStore', (): void => {
    it('returns the policies found in the directory.', async(): Promise<void> => {
      readdirMock.mockResolvedValueOnce([ 'a', 'b' ] as any);
      readFileMock.mockResolvedValueOnce(Buffer.from('<> a <http://example.com/type1> .'));
      readFileMock.mockResolvedValueOnce(Buffer.from('<> a <http://example.com/type2> .'));
      await expect(storage.getStore()).resolves.toBeRdfIsomorphic([
        DF.quad(DF.namedNode(baseIRI), RDF.terms.type, DF.namedNode('http://example.com/type1')),
        DF.quad(DF.namedNode(baseIRI), RDF.terms.type, DF.namedNode('http://example.com/type2')),
      ]);
      expect(readdirMock).toHaveBeenCalledTimes(1);
      expect(readdirMock).lastCalledWith(directoryPath);
      expect(readFileMock).toHaveBeenCalledTimes(2);
      expect(readFileMock).toHaveBeenNthCalledWith(1, path.join('/foo/bar', 'a'));
      expect(readFileMock).toHaveBeenNthCalledWith(2, path.join('/foo/bar', 'b'));
    });

    it('caches the policies in memory.', async(): Promise<void> => {
      readdirMock.mockResolvedValueOnce([ 'a', 'b' ] as any);
      readFileMock.mockResolvedValueOnce(Buffer.from('<> a <http://example.com/type1> .'));
      readFileMock.mockResolvedValueOnce(Buffer.from('<> a <http://example.com/type2> .'));

      // first store call
      await storage.getStore();
      await expect(storage.getStore()).resolves.toBeRdfIsomorphic([
        DF.quad(DF.namedNode(baseIRI), RDF.terms.type, DF.namedNode('http://example.com/type1')),
        DF.quad(DF.namedNode(baseIRI), RDF.terms.type, DF.namedNode('http://example.com/type2')),
      ]);
      expect(readdirMock).toHaveBeenCalledTimes(1);
      expect(readFileMock).toHaveBeenCalledTimes(2);
    });
  });

  it('can add data to the storage.', async(): Promise<void> => {
    readdirMock.mockResolvedValueOnce([ 'a', 'b' ] as any);
    readFileMock.mockResolvedValueOnce(Buffer.from('<> a <http://example.com/type1> .'));
    readFileMock.mockResolvedValueOnce(Buffer.from('<> a <http://example.com/type2> .'));

    await expect(storage.addRule(new Store([
      DF.quad(DF.namedNode(baseIRI), RDF.terms.type, DF.namedNode('http://example.com/type3')),
    ]))).resolves.toBeUndefined();
    await expect(storage.getStore()).resolves.toBeRdfIsomorphic([
      DF.quad(DF.namedNode(baseIRI), RDF.terms.type, DF.namedNode('http://example.com/type1')),
      DF.quad(DF.namedNode(baseIRI), RDF.terms.type, DF.namedNode('http://example.com/type2')),
      DF.quad(DF.namedNode(baseIRI), RDF.terms.type, DF.namedNode('http://example.com/type3')),
    ]);
  });

  it('can remove data from the storage.', async(): Promise<void> => {
    readdirMock.mockResolvedValueOnce([ 'a', 'b' ] as any);
    readFileMock.mockResolvedValueOnce(Buffer.from('<> a <http://example.com/type1> .'));
    readFileMock.mockResolvedValueOnce(Buffer.from('<> a <http://example.com/type2> .'));

    await expect(storage.removeData(new Store([
      DF.quad(DF.namedNode(baseIRI), RDF.terms.type, DF.namedNode('http://example.com/type1')),
    ]))).resolves.toBeUndefined();
    await expect(storage.getStore()).resolves.toBeRdfIsomorphic([
      DF.quad(DF.namedNode(baseIRI), RDF.terms.type, DF.namedNode('http://example.com/type2')),
    ]);
  });

  it('can return the relevant policy data.', async(): Promise<void> => {
    readdirMock.mockResolvedValueOnce([ 'a', 'b' ] as any);
    readFileMock.mockResolvedValueOnce(Buffer.from('<a> a <http://example.com/type1> .'));
    readFileMock.mockResolvedValueOnce(Buffer.from('<b> a <http://example.com/type2> .'));

    await expect(storage.getRule('http://example.com/a')).resolves.toBeRdfIsomorphic([
      DF.quad(DF.namedNode(baseIRI + 'a'), RDF.terms.type, DF.namedNode('http://example.com/type1')),
    ]);
  });

  it('does not support deleting rules by identifier.', async(): Promise<void> => {
    await expect(storage.deleteRule('a')).rejects.toThrow('not implemented');
  });
});
