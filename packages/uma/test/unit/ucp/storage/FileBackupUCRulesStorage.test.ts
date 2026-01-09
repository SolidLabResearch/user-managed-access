import { DataFactory as DF, Parser, Store } from 'n3';
import { Readable } from 'node:stream';
import { flushPromises } from '../../../../../../test/util/Util';
import { FileBackupUCRulesStorage } from '../../../../src/ucp/storage/FileBackupUCRulesStorage';
import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';

vi.useFakeTimers();

vi.mock('node:fs', () => ({
  createReadStream: vi.fn().mockReturnValue(Readable.from('<urn:a> <urn:b> <urn:c> .')),
  createWriteStream: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  rename: vi.fn(),
  unlink: vi.fn(),
}));

describe('FileBackupUCRulesStorage', (): void => {
  const policyString = `
    <http://example.org/1705937573496#usagePolicy> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/ns/odrl/2/Agreement> .
<http://example.org/1705937573496#usagePolicy> <http://www.w3.org/ns/odrl/2/permission> <http://example.org/1705937573496#permission> .
<http://example.org/1705937573496#permission> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/ns/odrl/2/Permission> .
<http://example.org/1705937573496#permission> <http://www.w3.org/ns/odrl/2/action> <http://www.w3.org/ns/odrl/2/use> .
<http://example.org/1705937573496#permission> <http://www.w3.org/ns/odrl/2/target> <http://localhost:3000/test.ttl> .
<http://example.org/1705937573496#permission> <http://www.w3.org/ns/odrl/2/assignee> <https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me> .
<http://example.org/1705937573496#permission> <http://www.w3.org/ns/odrl/2/assigner> <https://pod.woutslabbinck.com/profile/card#me> .`
  const ruleIRI = 'http://example.org/1705937573496#permission';
  const filePath = 'backup.ttl';
  let policy: Store;
  let storage: FileBackupUCRulesStorage;

  beforeEach(async(): Promise<void> => {
    vi.clearAllMocks();

    const parser = new Parser();
    const quads = parser.parse(policyString);
    policy = new Store(quads);

    storage = new FileBackupUCRulesStorage(filePath);
  });

  it('loads in the stored policies when initializing.', async(): Promise<void> => {
    await expect(storage.initialize()).resolves.toBeUndefined();

    // Give parser time to parse
    await flushPromises();

    const store = await storage.getStore();
    expect(store.size).toBe(1);
    expect(store.has(DF.quad(DF.namedNode('urn:a'), DF.namedNode('urn:b'), DF.namedNode('urn:c')))).toBe(true);
  });

  it('does not initialize any data if no file path is provided.', async(): Promise<void> => {
    storage = new FileBackupUCRulesStorage();
    await expect(storage.initialize()).resolves.toBeUndefined();

    await flushPromises();

    const store = await storage.getStore();
    expect(store.size).toBe(0);
    expect(fs.createReadStream).toHaveBeenCalledTimes(0);
  });

  it('backs up data every 5 minutes.', async(): Promise<void> => {
    // Need to modify data so it will be backed up
    await storage.addRule(policy);

    expect(fs.createWriteStream).not.toHaveBeenCalledOnce();

    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    await flushPromises();

    // Something weird with the mock, `toHaveBeenCalledTimes`, seems to not work correctly
    expect(fs.createWriteStream).toHaveBeenCalledExactlyOnceWith('backup.ttl', 'utf8');
    expect(fsPromises.rename).toHaveBeenCalledExactlyOnceWith('backup.ttl', 'backup.ttl.old');
    expect(fsPromises.unlink).toHaveBeenCalledExactlyOnceWith('backup.ttl.old');
  });

  it('does not remove the old file if it does not exist.', async(): Promise<void> => {
    await storage.addRule(policy);
    const error = new Error();
    (error as any).code = 'ENOENT';
    (error as any).syscall = 'call';
    vi.mocked(fsPromises.rename).mockRejectedValueOnce(error)

    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    await flushPromises();

    expect(fs.createWriteStream).toHaveBeenCalledExactlyOnceWith('backup.ttl', 'utf8');
    expect(fsPromises.unlink).not.toHaveBeenCalledExactlyOnceWith('backup.ttl.old');
  });

  it('does not backup data if no file path is provided.', async(): Promise<void> => {
    storage = new FileBackupUCRulesStorage();

    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    await flushPromises();

    expect(fsPromises.rename).not.toHaveBeenCalledOnce();
  });

  it('does not start a backup if there is one already in progress.', async(): Promise<void> => {
    await storage.addRule(policy);
    // Promise that does not end
    vi.mocked(fsPromises.unlink).mockResolvedValueOnce(new Promise(() => {}) as any);

    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    await flushPromises();

    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    await flushPromises();

    expect(fs.createWriteStream).toHaveBeenCalledExactlyOnceWith('backup.ttl', 'utf8');
  });

  it('does not backup data if no data was changed.', async(): Promise<void> => {
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    await flushPromises();

    expect(fs.createWriteStream).not.toHaveBeenCalledExactlyOnceWith('backup.ttl', 'utf8');
  });
});
