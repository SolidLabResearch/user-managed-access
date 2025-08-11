import 'jest-rdf';
import { DataFactory as DF, NamedNode, Parser, Store } from 'n3';
import { Mock, vi } from 'vitest';
import { ContainerUCRulesStorage } from '../../../src/storage/ContainerUCRulesStorage';
import { RDF } from '../../../src/util/Vocabularies';

describe('ContainerUCRulesStorage', (): void => {
  const containerTtl = `
    <> <http://www.w3.org/ns/ldp#contains> <http://example.com/policies/foo1>, <http://example.com/policies/foo2> .
  `;
  const foo1Ttl = `<> a <http://example.com/type1> .`;
  const foo2Ttl = `<> a <http://example.com/type2> .`;
  const containerUrl = 'http://example.com/policies/';
  const foo1 = DF.namedNode('http://example.com/policies/foo1');
  const foo2 = DF.namedNode('http://example.com/policies/foo2');
  const type1 = DF.namedNode('http://example.com/type1');
  const type2 = DF.namedNode('http://example.com/type2');
  let response: Response;
  let fetchMock: Mock<typeof fetch>;
  let storage: ContainerUCRulesStorage;

  beforeEach(async(): Promise<void> => {
    response = {
      status: 200,
      headers: new Headers({ 'content-type': 'text/turtle' }),
      text: vi.fn(),
    } satisfies Partial<Response> as any;
    fetchMock = vi.fn().mockResolvedValue(response);

    storage = new ContainerUCRulesStorage(containerUrl, fetchMock);
  });

  describe('.getStore', (): void => {
    it('can return a store containing all policies.', async(): Promise<void> => {
      vi.mocked(response.text).mockResolvedValueOnce(containerTtl);
      vi.mocked(response.text).mockResolvedValueOnce(foo1Ttl);
      vi.mocked(response.text).mockResolvedValueOnce(foo2Ttl);
      const store = await storage.getStore();
      expect(store.size).toBe(2);
      expect(store.countQuads(foo1, RDF.terms.type, type1, null)).toBe(1);
      expect(store.countQuads(foo2, RDF.terms.type, type2, null)).toBe(1);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(fetchMock).toHaveBeenNthCalledWith(1, containerUrl, { headers: { 'accept': 'text/turtle' }});
      expect(fetchMock).toHaveBeenNthCalledWith(2, foo1.value, { headers: { 'accept': 'text/turtle' }});
      expect(fetchMock).toHaveBeenNthCalledWith(3, foo2.value, { headers: { 'accept': 'text/turtle' }});
    });

    it('returns no data if a resource could not be found.', async(): Promise<void> => {
      (response as any).status = 404;
      const result = await storage.getStore();
      expect(result.size).toBe(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenNthCalledWith(1, containerUrl, { headers: { 'accept': 'text/turtle' }});
    });

    it('errors if an unexpected status code is returned.', async(): Promise<void> => {
      (response as any).status = 500;
      vi.mocked(response.text).mockResolvedValueOnce('bad data');
      await expect(storage.getStore()).rejects.toThrow(`Unable to access policy resource ${containerUrl
      }: 500 - bad data`);
    });

    it('errors if the response is not turtle.', async(): Promise<void> => {
      response.headers.set('content-type', 'application/ld+json');
      await expect(storage.getStore()).rejects
        .toThrow('Only turtle serialization is supported, received application/ld+json');
    });
  });

  describe('.addRule', (): void => {
    it('adds the rule through a PATCH request.', async(): Promise<void> => {
      const rule = new Store([
        DF.quad(foo1, RDF.terms.type, type1),
        DF.quad(foo2, RDF.terms.type, type2),
      ]);
      await expect(storage.addRule(rule)).resolves.toBeUndefined();
      expect(fetchMock.mock.calls[0][0]).toEqual(expect.stringContaining(containerUrl));
      expect(fetchMock.mock.calls[0][1]?.method).toBe('PATCH');
      expect(fetchMock.mock.calls[0][1]?.headers).toEqual({ 'content-type': 'text/n3' });
      const patch = new Store(new Parser({ format: 'n3' }).parse(fetchMock.mock.calls[0][1]!.body as string));
      const subjects = patch.getSubjects(RDF.terms.type, 'http://www.w3.org/ns/solid/terms#InsertDeletePatch', null);
      expect(subjects).toHaveLength(1);
      const insertFormulas = patch.getObjects(subjects[0], 'http://www.w3.org/ns/solid/terms#inserts', null);
      expect(insertFormulas).toHaveLength(1);
      const inserts = patch.getQuads(null, null, null, insertFormulas[0]);
      expect(inserts).toEqualRdfQuadArray([
        DF.quad(foo1, RDF.terms.type, type1, insertFormulas[0] as NamedNode),
        DF.quad(foo2, RDF.terms.type, type2, insertFormulas[0] as NamedNode),
      ]);
    });

    it('performs no request if there is no input data.', async(): Promise<void> => {
      await expect(storage.addRule(new Store())).resolves.toBeUndefined();
      expect(fetchMock).toHaveBeenCalledTimes(0);
    });

    it('errors if the fetch fails.', async(): Promise<void> => {
      (response as any).status = 500;
      vi.mocked(response.text).mockResolvedValueOnce('bad data');
      const rule = new Store([
        DF.quad(foo1, RDF.terms.type, type1),
        DF.quad(foo2, RDF.terms.type, type2),
      ]);
      await expect(storage.addRule(rule)).rejects.toThrow('Could not add rule to the storage: 500 - bad data');
    });
  });

  describe('.getRule', (): void => {
    it('extracts the matching rule.', async(): Promise<void> => {
      vi.mocked(response.text).mockResolvedValueOnce(`<> <http://www.w3.org/ns/ldp#contains> <http://example.com/policies/foo1>.`);
      vi.mocked(response.text).mockResolvedValueOnce(`
        <a> <b> <c> ;
            <d> <e> .
        <f> <g> <h> .
      `);
      await expect(storage.getRule(`${containerUrl}a`)).resolves.toBeRdfIsomorphic([
        DF.quad(DF.namedNode(`${containerUrl}a`), DF.namedNode(`${containerUrl}b`), DF.namedNode(`${containerUrl}c`)),
        DF.quad(DF.namedNode(`${containerUrl}a`), DF.namedNode(`${containerUrl}d`), DF.namedNode(`${containerUrl}e`)),
      ]);
    });
  });

  describe('.deleteRule', (): void => {
    it('is not supported.', async(): Promise<void> => {
      await expect(storage.deleteRule('a')).rejects.toThrow('not implemented');
    });
  });

  describe('.removeData', (): void => {
    it('sends PATCH requests to all resources with relevant data.', async(): Promise<void> => {
      vi.mocked(response.text).mockResolvedValueOnce(containerTtl);
      vi.mocked(response.text).mockResolvedValueOnce(foo1Ttl);
      vi.mocked(response.text).mockResolvedValueOnce(foo2Ttl);

      const removeData = new Store([
        DF.quad(foo1, RDF.terms.type, type1),
        DF.quad(foo2, RDF.terms.type, type2),
      ]);
      await expect(storage.removeData(removeData)).resolves.toBeUndefined();
      expect(fetchMock).toHaveBeenCalledTimes(5);
      expect(fetchMock.mock.calls[3][0]).toBe(foo1.value);
      expect(fetchMock.mock.calls[4][0]).toBe(foo2.value);

      // first patch
      expect(fetchMock.mock.calls[3][1]?.method).toBe('PATCH');
      expect(fetchMock.mock.calls[3][1]?.headers).toEqual({ 'content-type': 'text/n3' });
      let patch = new Store(new Parser({ format: 'n3' }).parse(fetchMock.mock.calls[3][1]!.body as string));
      let subjects = patch.getSubjects(RDF.terms.type, 'http://www.w3.org/ns/solid/terms#InsertDeletePatch', null);
      expect(subjects).toHaveLength(1);
      let insertFormulas = patch.getObjects(subjects[0], 'http://www.w3.org/ns/solid/terms#deletes', null);
      expect(insertFormulas).toHaveLength(1);
      let inserts = patch.getQuads(null, null, null, insertFormulas[0]);
      expect(inserts).toEqualRdfQuadArray([
        DF.quad(foo1, RDF.terms.type, type1, insertFormulas[0] as NamedNode),
      ]);

      // second patch
      expect(fetchMock.mock.calls[4][1]?.method).toBe('PATCH');
      expect(fetchMock.mock.calls[4][1]?.headers).toEqual({ 'content-type': 'text/n3' });
      patch = new Store(new Parser({ format: 'n3' }).parse(fetchMock.mock.calls[4][1]!.body as string));
      subjects = patch.getSubjects(RDF.terms.type, 'http://www.w3.org/ns/solid/terms#InsertDeletePatch', null);
      expect(subjects).toHaveLength(1);
      insertFormulas = patch.getObjects(subjects[0], 'http://www.w3.org/ns/solid/terms#deletes', null);
      expect(insertFormulas).toHaveLength(1);
      inserts = patch.getQuads(null, null, null, insertFormulas[0]);
      expect(inserts).toEqualRdfQuadArray([
        DF.quad(foo2, RDF.terms.type, type2, insertFormulas[0] as NamedNode),
      ]);
    });

    it('only sends requests to resources that have matches.', async(): Promise<void> => {
      vi.mocked(response.text).mockResolvedValueOnce(containerTtl);
      vi.mocked(response.text).mockResolvedValueOnce(foo1Ttl);
      vi.mocked(response.text).mockResolvedValueOnce(foo2Ttl);

      const removeData = new Store([ DF.quad(foo2, RDF.terms.type, type2) ]);
      await expect(storage.removeData(removeData)).resolves.toBeUndefined();
      expect(fetchMock).toHaveBeenCalledTimes(4);
      expect(fetchMock.mock.calls[3][0]).toBe(foo2.value);
    });

    it('does no requests if there is no data to remove.', async(): Promise<void> => {
      await expect(storage.removeData(new Store())).resolves.toBeUndefined();
      expect(fetchMock).toHaveBeenCalledTimes(0);
    });

    it('errors if the update fails.', async(): Promise<void> => {
      fetchMock.mockResolvedValueOnce({ ...response, text: vi.fn().mockResolvedValue(containerTtl) });
      fetchMock.mockResolvedValueOnce({ ...response, text: vi.fn().mockResolvedValue(foo1Ttl) });
      fetchMock.mockResolvedValueOnce({ ...response, text: vi.fn().mockResolvedValue(foo2Ttl) });
      fetchMock.mockResolvedValueOnce({ ...response, status: 400, text: vi.fn().mockResolvedValue('bad data') });

      const removeData = new Store([
        DF.quad(foo1, RDF.terms.type, type1),
        DF.quad(foo2, RDF.terms.type, type2),
      ]);
      await expect(storage.removeData(removeData)).rejects.toThrow('Could not update rule resource http://example.com/policies/foo1: 400 - bad data');
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });
  });
});
